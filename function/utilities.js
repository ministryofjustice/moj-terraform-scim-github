// @octokit/core configuration
const { Octokit } = require('@octokit/core')
const { paginateGraphql } = require('@octokit/plugin-paginate-graphql')
const OctokitWithPagination = Octokit.plugin(paginateGraphql)
const octokit = new OctokitWithPagination({ auth: process.env.GITHUB_TOKEN })

// @aws-sdk/client-identitystore configuration
const {
  IdentitystoreClient,
  CreateGroupCommand,
  CreateGroupMembershipCommand,
  CreateUserCommand,
  DeleteGroupCommand,
  DeleteGroupMembershipCommand,
  DeleteUserCommand,
  ListGroupMembershipsCommand,
  paginateListUsers,
  paginateListGroups
} = require('@aws-sdk/client-identitystore')

const identitystoreClient = new IdentitystoreClient({ region: process.env.SSO_AWS_REGION })
const awsPaginatorConfig = {
  client: identitystoreClient,
  pageSize: 100
}

// Generic helpers
const dryrun = (!process.env.NOT_DRY_RUN || process.env.NOT_DRY_RUN === 'false')

// GitHub
function generateQuery () {
  return `
    query paginate($cursor: String, $organization: String!) {
      organization(login: $organization) {
        teams(first: 100, after: $cursor) {
          nodes {
            slug
            members(first: 100) {
              nodes {
                login
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `
}

async function getGitHubOrganisationTeamsAndMemberships () {
  const { organization } = await octokit.graphql.paginate(generateQuery(), { organization: process.env.GITHUB_ORGANISATION })

  const teamsWithoutAllOrgMembers = organization.teams.nodes.filter((team) => team.slug !== 'all-org-members')

  // Handle teams with 100+ members by fetching additional member pages
  const teams = []
  for (const team of teamsWithoutAllOrgMembers) {
    let allMembers = [...team.members.nodes]
    let hasNextPage = team.members.pageInfo.hasNextPage
    let cursor = team.members.pageInfo.endCursor

    // Fetch additional member pages if needed
    while (hasNextPage) {
      const additionalMembersQuery = `
        query($organization: String!, $teamSlug: String!, $cursor: String!) {
          organization(login: $organization) {
            team(slug: $teamSlug) {
              members(first: 100, after: $cursor) {
                nodes {
                  login
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        }
      `
      
      const result = await octokit.graphql(additionalMembersQuery, {
        organization: process.env.GITHUB_ORGANISATION,
        teamSlug: team.slug,
        cursor: cursor
      })

      allMembers = [...allMembers, ...result.organization.team.members.nodes]
      hasNextPage = result.organization.team.members.pageInfo.hasNextPage
      cursor = result.organization.team.members.pageInfo.endCursor
    }

    teams.push({
      name: team.slug.toLowerCase(),
      members: allMembers.map((user) => {
        return {
          name: user.login.toLowerCase()
        }
      })
    })
  }

  const users = teams.map((team) => {
    return team.members.map((member) => {
      return member.name
    })
  }).flat()

  return {
    teams: teams,
    users: [...new Set(users)].map((username) => {
      return {
        name: username.toLowerCase()
      }
    })
  }
}

// Identity Store
function identityStoreUserMap (user) {
  return {
    id: user.UserId,
    name: user.UserName.replace(process.env.SSO_EMAIL_SUFFIX, ''),
    Emails: user.Emails // Capture Emails for later checks
  }
}

function identityStoreGroupMap (group) {
  return {
    id: group.GroupId,
    name: group.DisplayName
  }
}

async function getIdentityStoreValuesByType (type) {
  const paginator = type === 'groups' ? paginateListGroups : paginateListUsers
  const mapper = type === 'groups' ? identityStoreGroupMap : identityStoreUserMap
  const key = type === 'groups' ? 'Groups' : 'Users'

  const list = []

  // Include 'Emails' when fetching user details
  const params = {
    IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID,
    ...(type === 'users' && { AttributesToGet: ['UserName', 'Emails'] }) // Fetch 'Emails' for users
  }

  for await (const page of paginator(awsPaginatorConfig, params)) {
    const values = [...page[key]].map(mapper)
    list.push(...values)
  }

  return list
}

function sendCreateCommand (type, parameters) {
  let command

  if (type === 'groups') {
    command = new CreateGroupCommand(parameters)
  }

  if (type === 'users') {
    command = new CreateUserCommand(parameters)
  }

  if (type === 'membership') {
    command = new CreateGroupMembershipCommand(parameters)
  }

  return identitystoreClient.send(command)
}

function sendDeleteCommand (type, parameters) {
  let command

  if (type === 'groups') {
    command = new DeleteGroupCommand(parameters)
  }

  if (type === 'users') {
    command = new DeleteUserCommand(parameters)
  }

  if (type === 'membership') {
    command = new DeleteGroupMembershipCommand(parameters)
  }

  return identitystoreClient.send(command)
}

async function getIdentityStoreGroupMemberships (groupId) {
  const parameters = {
    IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID,
    GroupId: groupId
  }
  const command = new ListGroupMembershipsCommand(parameters)
  try {
    const response = await identitystoreClient.send(command)
    return response.GroupMemberships.map((membership) => {
      return {
        userId: membership.MemberId.UserId,
        membershipId: membership.MembershipId
      }
    })
  } catch (ThrottlingException) {
    const secondsToWait = Number(ThrottlingException.RetryAfterSeconds)
    await new Promise(resolve => setTimeout(resolve, secondsToWait))
    const response = await identitystoreClient.send(command)
    return response.GroupMemberships.map((membership) => {
      return {
        userId: membership.MemberId.UserId,
        membershipId: membership.MembershipId
      }
    })
  }
}

// Reconciler
function reconcile (original, updated) {
  return {
    create: updated.filter(function (updatedItem) {
      return !original.find(function (originalItem) {
        return originalItem.name === updatedItem.name
      })
    }),
    delete: original.filter(function (originalItem) {
      return !updated.find(function (updatedItem) {
        return updatedItem.name === originalItem.name
      })
    })
  }
}

// Generate parameter shape
function generateParametersForTypeAction (type, action, data) {
  if (type === 'groups') {
    if (action === 'create') {
      return {
        DisplayName: data.name,
        IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID
      }
    }
    if (action === 'delete') {
      return {
        GroupId: data.id,
        IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID
      }
    }
  }

  if (type === 'users') {
    if (action === 'create') {
      const name = `${data.name}${process.env.SSO_EMAIL_SUFFIX}`

      return {
        UserName: name,
        DisplayName: name,
        Name: {
          FamilyName: name,
          GivenName: name
        },
        Emails: [
          {
            Primary: true,
            Type: 'work',
            Value: name
          }
        ],
        IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID
      }
    }
    if (action === 'delete') {
      return {
        UserId: data.id,
        IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID
      }
    }
  }

  if (type === 'membership') {
    if (action === 'create') {
      return {
        GroupId: data.group.id,
        MemberId: {
          UserId: data.id
        },
        IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID
      }
    }
    if (action === 'delete') {
      return {
        MembershipId: data.membershipId,
        IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID
      }
    }
  }

  throw new Error(`Parameters not generated: type "${type}" action "${action}" not valid`)
}

// Syncer
function generateMessage (action, type, data, meta) {
  const message = []

  if (dryrun) {
    message.push('DRYRUN:')
  }

  message.push(`[${action}]`)
  message.push(`[${type}]`)

  if (type === 'membership') {
    message.push(`[${data.name} <=> ${data.group.name}]`)
  } else {
    message.push(`[${data.name}]`)
  }

  message.push(meta)

  return message.join(' ')
}

async function sync (type, payload) {
  if (payload.create.length) {
    for (const needsCreating of payload.create) {
      const parameters = generateParametersForTypeAction(type, 'create', needsCreating)

      console.log(generateMessage('create', type, needsCreating, JSON.stringify(parameters)))

      if (!dryrun) {
        try {
          await sendCreateCommand(type, parameters)
        } catch (error) {
          console.log('[error]', error)
        }
      }
    }
  }

  if (payload.delete.length) {
    for (const needsDeleting of payload.delete) {
      // Don't delete users with an 'EntraId' email type
      if (type === 'users' && needsDeleting.Emails && needsDeleting.Emails.some(email => email.Type === 'EntraId')) {
        console.log(`Skipping deletion of user with EntraId email: ${needsDeleting.Emails.map(email => email.Value).join(', ')}`)
        continue;
      }

      // Don't delete groups that start with 'azure-aws-sso-' [EntraID groups]
      if (type === 'groups' && needsDeleting.name && needsDeleting.name.startsWith('azure-aws-sso-')) {
        console.log(`Skipping deletion of group with name: ${needsDeleting.name}`)
        continue;
      }
      const parameters = generateParametersForTypeAction(type, 'delete', needsDeleting)

      console.log(generateMessage('delete', type, needsDeleting, JSON.stringify(parameters)))

      if (!dryrun) {
        try {
          await sendDeleteCommand(type, parameters)
        } catch (error) {
          console.log('[error]', error)
        }
      }
    }
  }
}

module.exports = {
  getGitHubOrganisationTeamsAndMemberships,
  getIdentityStoreValuesByType,
  getIdentityStoreGroupMemberships,
  reconcile,
  sync
}
