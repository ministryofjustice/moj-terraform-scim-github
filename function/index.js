import {
  getGitHubOrganisationTeamsAndMemberships,
  getIdentityStoreValuesByType,
  getIdentityStoreGroupMemberships,
  reconcile,
  sync,
} from "./utilities.js"

export const handler = async () => {
  // Check required variables are set
  [
    "GITHUB_ORGANISATION",
    "GITHUB_APP_ID",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_APP_INSTALLATION_ID",
    "SSO_AWS_REGION",
    "SSO_EMAIL_SUFFIX",
    "SSO_IDENTITY_STORE_ID",
  ].forEach((variable) => {
    const missing = []
    if (!Object.keys(process.env).includes(variable)) {
      missing.push(variable)
    }

    if (missing.length) {
      throw new Error(`Missing variables: ${missing.join(", ")}`)
    }
  })

  const gitHubTeamsIgnoreList = ["all-org-mebmers", "business-units"]
  if (!process.env.NOT_DRY_RUN || process.env.NOT_DRY_RUN === "false") {
    console.log("Mode: dry-run (set env var NOT_DRY_RUN to `true` to change)")
  }

  const github = await getGitHubOrganisationTeamsAndMemberships(gitHubTeamsIgnoreList)

  // Reconcile groups
  const identityStoreGroups = await getIdentityStoreValuesByType("groups")
  const reconcileGroups = reconcile(identityStoreGroups, github.teams)
  await sync("groups", reconcileGroups)

  // Reconcile users
  const identityStoreUsers = await getIdentityStoreValuesByType("users")
  const reconcileUsers = reconcile(identityStoreUsers, github.users)
  await sync("users", reconcileUsers)

  // Reconcile group memberships
  const refreshedGroups = await getIdentityStoreValuesByType("groups")
  const refreshedUsers = await getIdentityStoreValuesByType("users")

  for await (const group of refreshedGroups) {
    const groupMemberships = await getIdentityStoreGroupMemberships(group.id)
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
      await sync(
        "membership",
        reconcileMembership,
      )
    }
  }
}

// Uncomment this when running locally
// (async function() { await module.exports.handler() })()
