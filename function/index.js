import {
  getGitHubOrganisationTeamsAndMemberships,
  reconcile,
} from './utilities.js'
import { IdentityStoreService } from './identityStoreService.js'
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
  const dryrun = !process.env.NOT_DRY_RUN || process.env.NOT_DRY_RUN === 'false'
  if (dryrun) {
    console.log('Mode: dry-run (set env var NOT_DRY_RUN to `true` to change)')
  }

  await scimGitHubToAWSIdentityStore({
    octokit: octokit,
    identitystore: identitystore,
    identitystoreClient: identitystoreClient,
    gitHubTeamsIgnoreList: ['all-org-members', 'business-units'],
    dryrun: dryrun,
  })
}

export const scimGitHubToAWSIdentityStore = async ({
  octokit,
  identitystore,
  identitystoreClient,
  gitHubTeamsIgnoreList,
  dryrun,
}) => {
  const identityStoreService = new IdentityStoreService(
    identitystoreClient,
    identitystore,
    dryrun,
  )

  const github = await getGitHubOrganisationTeamsAndMemberships(
    gitHubTeamsIgnoreList,
    octokit,
  )

  await syncGithubTeamsToIdentityStoreGroups(identityStoreService, github.teams)
  await syncGithubUsersToIdentityStoreUsers(identityStoreService, github.users)
  await syncGitHubTeamMembershipsToIdentityStoreGroupMemberships(
    identityStoreService,
    github.teams,
  )
}

const syncGithubTeamsToIdentityStoreGroups = async (
  identityStoreService,
  githubTeams,
) => {
  const identityStoreGroups =
    await identityStoreService.getIdentityStoreGroups()
  const reconcileGroups = reconcile(identityStoreGroups, githubTeams)
  for (const needsCreating of reconcileGroups.create) {
    identityStoreService.createGroup(needsCreating.name)
  }
  for (const needsDeleting of reconcileGroups.delete) {
    identityStoreService.deleteGroup(needsDeleting.id, needsDeleting.name)
  }
}

const syncGithubUsersToIdentityStoreUsers = async (
  identityStoreService,
  githubUsers,
) => {
  const identityStoreUsers = await identityStoreService.getIdentityStoreUsers()
  const reconcileUsers = reconcile(identityStoreUsers, githubUsers)
  for (const needsCreating of reconcileUsers.create) {
    identityStoreService.createUser(needsCreating.name)
  }
  for (const needsDeleting of reconcileUsers.delete) {
    identityStoreService.deleteUser(needsDeleting.id, needsDeleting.Emails)
  }
}

const syncGitHubTeamMembershipsToIdentityStoreGroupMemberships = async (
  identityStoreService,
  githubTeams,
) => {
  const refreshedGroups = await identityStoreService.getIdentityStoreGroups()
  const refreshedUsers = await identityStoreService.getIdentityStoreUsers()

  for await (const group of refreshedGroups) {
    if (group.name && group.name.startsWith('azure-aws-sso-')) {
      continue
    }

    const groupMemberships =
      await identityStoreService.getIdentityStoreGroupMemberships(group.id)
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

    const githubTeam = githubTeams.find((team) => {
      return team.name === group.name
    })

    if (!githubTeam) {
      console.log(`cannot find ${group.name} - skipping`)
      continue
    }

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
    for (const needsCreating of reconcileMembership.create) {
      identityStoreService.createGroupMembership(
        needsCreating.group.id,
        needsCreating.id,
      )
    }
    for (const needsDeleting of reconcileMembership.delete) {
      identityStoreService.deleteGroupMembership(needsDeleting.membershipId)
    }
  }
}
