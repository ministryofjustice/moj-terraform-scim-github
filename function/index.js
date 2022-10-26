const utilities = require('./utilities.js')

module.exports.handler = async () => {
  // Check required variables are set
  [
    'GITHUB_ORGANISATION',
    'GITHUB_TOKEN',
    'SSO_AWS_REGION',
    'SSO_EMAIL_SUFFIX',
    'SSO_IDENTITY_STORE_ID'
  ].forEach(variable => {
    const missing = []
    if (!Object.keys(process.env).includes(variable)) {
      missing.push(variable)
    }

    if (missing.length) {
      throw new Error(`Missing variables: ${missing.join(', ')}`)
    }
  })

  if (!process.env.NOT_DRY_RUN || process.env.NOT_DRY_RUN === 'false') {
    console.log('Mode: dry-run (set env var NOT_DRY_RUN to `true` to change)')
  }

  /*
    Get GitHub data (organisation teams and memberships)
  */
  const github = await utilities.getGitHubOrganisationTeamsAndMemberships()

  /*
    Reconcile groups
  */
  const identityStoreGroups = await utilities.getIdentityStoreValuesByType('groups').catch(error => {
    throw new Error(error)
  })
  const reconcileGroups = utilities.reconcile(identityStoreGroups, github.teams)
  const syncGroups = await utilities.sync('groups', reconcileGroups).catch(error => {
    throw new Error(error)
  })

  /*
    Reconcile users
  */
  const identityStoreUsers = await utilities.getIdentityStoreValuesByType('users').catch(error => {
    throw new Error(error)
  })
  const reconcileUsers = utilities.reconcile(identityStoreUsers, github.users)
  const syncUsers = await utilities.sync('users', reconcileUsers).catch(error => {
    throw new Error(error)
  })

  /*
    Reconcile group memberships
  */
  const refreshedGroups = await utilities.getIdentityStoreValuesByType('groups').catch(error => {
    throw new Error(error)
  })
  const refreshedUsers = await utilities.getIdentityStoreValuesByType('users').catch(error => {
    throw new Error(error)
  })

  for await (const group of refreshedGroups) {
    const groupMemberships = await utilities.getIdentityStoreGroupMemberships(group.id)
    const groupMembershipsWithGroupDetails = groupMemberships.map((membership) => {
      const user = refreshedUsers.find(function (user) {
        return user.id === membership.userId
      })

      return {
        ...user,
        membershipId: membership.membershipId,
        group: group
      }
    })

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
          group: group
        }
      })

      const reconcileMembership = utilities.reconcile(groupMembershipsWithGroupDetails, githubTeamMembership)
      const syncMembership = await utilities.sync('membership', reconcileMembership).catch(error => {
        throw new Error(error)
      })
    }
  }
}
