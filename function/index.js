const utilities = require('./utilities.js')

module.exports.handler = async () => {
  /*
    Reconcile groups
  */
  const githubGroups = await utilities.githubGetGroups().catch(error => {
    console.log(error)
  })
  const reconcileGroups = await utilities.reconcileGroups(githubGroups).catch(error => {
    console.log(error)
  })
  await utilities.syncGroups(reconcileGroups).catch(error => {
    console.log(error)
  })

  /*
    Reconcile members
  */
  const githubOrgMembers = await utilities.githubGetOrgMembers().catch(error => {
    console.log(error)
  })
  const reconcileMembers = await utilities.reconcileMembers(githubOrgMembers).catch(error => {
    console.log(error)
  })
  await utilities.syncMembers(reconcileMembers).catch(error => {
    console.log(error)
  })
}
