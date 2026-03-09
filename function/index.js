import {
  getGitHubOrganisationTeamsAndMemberships,
} from './gitHubService.js'
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
  const reconcileGroupsPlan = reconcile(identityStoreGroups, githubTeams)
  for (const group of reconcileGroupsPlan.create) {
    identityStoreService.createGroup(group.name)
  }
  for (const group of reconcileGroupsPlan.delete) {
    identityStoreService.deleteGroup(group.id, group.name)
  }
}

const syncGithubUsersToIdentityStoreUsers = async (
  identityStoreService,
  githubUsers,
) => {
  const identityStoreUsers = await identityStoreService.getIdentityStoreUsers()
  const reconsileUsersPlan = reconcile(identityStoreUsers, githubUsers)
  for (const user of reconsileUsersPlan.create) {
    identityStoreService.createUser(user.name)
  }
  for (const user of reconsileUsersPlan.delete) {
    identityStoreService.deleteUser(user.id, user.Emails)
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

    const reconcileGroupMembershipsPlan = reconcile(
      groupMembershipsWithGroupDetails,
      githubTeamMembership,
    )
    for (const membership of reconcileGroupMembershipsPlan.create) {
      identityStoreService.createGroupMembership(
        membership.group.id,
        membership.id,
      )
    }
    for (const membership of reconcileGroupMembershipsPlan.delete) {
      identityStoreService.deleteGroupMembership(membership.membershipId)
    }
  }
}

export function reconcile(identityStoreItems, gitHubItems) {
  const itemsHaveTheSameName = (firstItem, secondItem) =>
    firstItem.name === secondItem.name

  const listContainsAnItemWithTheSameNameAs = (list, itemToMatch) =>
    list.some((itemInList) => itemsHaveTheSameName(itemInList, itemToMatch))

  const itemsThatAreInGitHubButNotInIdentityStore = gitHubItems.filter(
    (updatedItem) =>
      !listContainsAnItemWithTheSameNameAs(identityStoreItems, updatedItem),
  )

  const itemsThatAreInIdentityStoreButNotInGitHub = identityStoreItems.filter(
    (originalItem) =>
      !listContainsAnItemWithTheSameNameAs(gitHubItems, originalItem),
  )

  return {
    create: itemsThatAreInGitHubButNotInIdentityStore,
    delete: itemsThatAreInIdentityStoreButNotInGitHub,
  }
}
