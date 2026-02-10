import {
  getGitHubOrganisationTeamsAndMemberships,
  getIdentityStoreValuesByType,
  getIdentityStoreGroupMemberships,
  reconcile,
  sync,
} from './utilities.js'
import * as identitystore from '@aws-sdk/client-identitystore'
import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/core'
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql'

export const handler = async () => {
  // Check required variables are set
  const requiredVariables = [
    'GITHUB_ORGANISATION',
    'GITHUB_APP_ID',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_APP_INSTALLATION_ID',
    'SSO_AWS_REGION',
    'SSO_EMAIL_SUFFIX',
    'SSO_IDENTITY_STORE_ID',
  ]
  const missingVariables = []
  requiredVariables.forEach((variable) => {
    if (!Object.keys(process.env).includes(variable)) {
      missingVariables.push(variable)
    }
  })
  if (missingVariables.length) {
    throw new Error(`Missing variables: ${missingVariables.join(', ')}`)
  }

  const OctokitWithPagination = Octokit.plugin(paginateGraphQL)
  const octokit = new OctokitWithPagination({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
      installationId: process.env.GITHUB_APP_INSTALLATION_ID,
    },
  })

  const identitystoreClient = new identitystore.IdentitystoreClient({
    region: process.env.SSO_AWS_REGION,
  })

  if (!process.env.NOT_DRY_RUN || process.env.NOT_DRY_RUN === 'false') {
    console.log('Mode: dry-run (set env var NOT_DRY_RUN to `true` to change)')
  }

  await scimGitHubToAWSIdentityStore({ octokit: octokit, identitystore: identitystore, identitystoreClient: identitystoreClient, gitHubTeamsIgnoreList: ['all-org-members', 'business-units'] })
}

export const scimGitHubToAWSIdentityStore = async ({ octokit, identitystore, identitystoreClient, gitHubTeamsIgnoreList }) => {
  const github = await getGitHubOrganisationTeamsAndMemberships(
    gitHubTeamsIgnoreList, octokit
  )

  // Reconcile groups
  const identityStoreGroups = await getIdentityStoreValuesByType('groups', identitystore, identitystoreClient)
  const reconcileGroups = reconcile(identityStoreGroups, github.teams)
  await sync('groups', reconcileGroups)

  // Reconcile users
  const identityStoreUsers = await getIdentityStoreValuesByType('users', identitystore, identitystoreClient)
  const reconcileUsers = reconcile(identityStoreUsers, github.users)
  await sync('users', reconcileUsers)

  // Reconcile group memberships
  const refreshedGroups = await getIdentityStoreValuesByType('groups', identitystore, identitystoreClient)
  const refreshedUsers = await getIdentityStoreValuesByType('users', identitystore, identitystoreClient)

  for await (const group of refreshedGroups) {
    const groupMemberships = await getIdentityStoreGroupMemberships(group.id, identitystoreClient)
    const groupMembershipsWithGroupDetails = groupMemberships.map(
      (membership) => {
        const user = refreshedUsers.find(
          (user) => user.id === membership.userId,
        )

        return {
          ...user,
          membershipId: membership.membershipId,
          group: group,
        }
      },
    )

    const githubTeam = github.teams.find((team) => {
      return team.name === group.name
    })

    if (!githubTeam) {
      console.log(`cannot find ${group.name} - skipping`)
    } else {
      const githubTeamMembership = githubTeam.members.map((user) => {
        const refreshedUser = refreshedUsers.find((refreshedUser) => {
          return refreshedUser.name === user.name
        })

        return {
          ...refreshedUser,
          group: group,
        }
      })

      const reconcileMembership = reconcile(
        groupMembershipsWithGroupDetails,
        githubTeamMembership,
      )
      await sync('membership', reconcileMembership)
    }
  }
}
