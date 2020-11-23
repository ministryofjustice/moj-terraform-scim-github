const utilities = require('./utilities.js')

module.exports.handler = async () => {
  // Check required variables are set
  [
    'GITHUB_ORGANISATION',
    'GITHUB_TOKEN',
    'SSO_AWS_REGION',
    'SSO_EMAIL_SUFFIX',
    'SSO_SCIM_TOKEN',
    'SSO_TENANT_ID'
  ].forEach(variable => {
    const missing = []
    if (!Object.keys(process.env).includes(variable)) {
      missing.push(variable)
    }

    if (missing.length) {
      throw new Error(`Missing variables: ${missing.join(', ')}`)
    }
  })

  /*
    Reconcile groups
  */
  const githubGroups = await utilities.githubGetGroups().catch(error => {
    throw new Error(error)
  })
  const reconcileGroups = await utilities.reconcileGroups(githubGroups).catch(error => {
    throw new Error(error)
  })
  await utilities.syncGroups(reconcileGroups).catch(error => {
    throw new Error(error)
  })

  /*
    Reconcile members
  */
  const githubOrgMembers = await utilities.githubGetOrgMembers().catch(error => {
    throw new Error(error)
  })
  const reconcileMembers = await utilities.reconcileMembers(githubOrgMembers).catch(error => {
    throw new Error(error)
  })
  await utilities.syncMembers(reconcileMembers).catch(error => {
    throw new Error(error)
  })
}
