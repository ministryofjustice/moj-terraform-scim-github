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
    Reconcile groups
  */
  const githubGroups = await utilities.getGitHubValuesByType('groups', 'slug').catch(error => {
    throw new Error(error)
  })
  const identityStoreGroups = await utilities.getIdentityStoreValuesByType('groups').catch(error => {
    throw new Error(error)
  })
  const reconcileGroups = utilities.reconcile(identityStoreGroups, githubGroups)
  const syncGroups = await utilities.sync('groups', reconcileGroups).catch(error => {
    throw new Error(error)
  })

  /*
    Reconcile users
  */
  const githubUsers = await utilities.getGitHubValuesByType('users', 'login').catch(error => {
    throw new Error(error)
  })
  const identityStoreUsers = await utilities.getIdentityStoreValuesByType('users').catch(error => {
    throw new Error(error)
  })
  const reconcileUsers = utilities.reconcile(identityStoreUsers, githubUsers)
  const syncUsers = await utilities.sync('users', reconcileUsers).catch(error => {
    throw new Error(error)
  })
}
