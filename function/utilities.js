// @octokit/rest configuration
const { Octokit } = require('@octokit/rest')
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

// @aws-sdk/client-identitystore configuration
const {
  IdentitystoreClient,
  CreateUserCommand,
  DeleteUserCommand,
  CreateGroupCommand,
  DeleteGroupCommand,
  paginateListUsers,
  paginateListGroups
} = require('@aws-sdk/client-identitystore')

const identitystoreClient = new IdentitystoreClient({ region: process.env.SSO_AWS_REGION })
const awsPaginatorConfig = {
  client: identitystoreClient,
  pageSize: 100
}

// Generic helpers
const dryrun = !process.env.NOT_DRY_RUN

// GitHub
function getGitHubValuesByType (type, key) {
  const endpoint = type === 'groups' ? octokit.teams.list : octokit.orgs.listMembers

  return octokit.paginate(endpoint, {
    org: process.env.GITHUB_ORGANISATION
  }).then(function (list) {
    return list.map(function (item) {
      return {
        name: item[key].toLowerCase()
      }
    })
  })
}

// Identity Store
function identityStoreUserMap (user) {
  return {
    id: user.UserId,
    name: user.UserName.replace(process.env.SSO_EMAIL_SUFFIX, '')
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

  for await (const page of paginator(awsPaginatorConfig, { IdentityStoreId: process.env.SSO_IDENTITY_STORE_ID })) {
    const values = [...page[key]].map(mapper)
    list.push(...values)
  }

  return list
}

function sendCreateCommand (type, parameters) {
  const command = type === 'groups' ? new CreateGroupCommand(parameters) : new CreateUserCommand(parameters)
  return identitystoreClient.send(command)
}

function sendDeleteCommand (type, parameters) {
  const command = type === 'groups' ? new DeleteGroupCommand(parameters) : new DeleteUserCommand(parameters)
  return identitystoreClient.send(command)
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

  throw new Error(`Parameters not generated: type "${type}" action "${action}" not valid`)
}

// Syncer
async function sync (type, payload) {
  if (payload.create.length) {
    for (const needsCreating of payload.create) {
      const parameters = generateParametersForTypeAction(type, 'create', needsCreating)

      if (dryrun) {
        console.log(`DRYRUN: [create] [${type}] [${needsCreating.name}]`, JSON.stringify(parameters))
      } else {
        console.log(`[create] [${type}] [${needsCreating.name}]`)
        await sendCreateCommand(type, parameters)
      }
    }
  }

  if (payload.delete.length) {
    for (const needsDeleting of payload.delete) {
      const parameters = generateParametersForTypeAction(type, 'delete', needsDeleting)

      if (dryrun) {
        console.log(`DRYRUN: [delete] [${type}] [${needsDeleting.name}]`, JSON.stringify(parameters))
      } else {
        console.log(`[delete] [${type}] [${needsDeleting.name}]`)
        await sendDeleteCommand(type, parameters)
      }
    }
  }
}

module.exports = {
  getGitHubValuesByType,
  getIdentityStoreValuesByType,
  reconcile,
  sync
}
