// GitHub rest.js configuration
const { Octokit } = require('@octokit/rest')
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

// Axios configuration
const axios = require('axios')
const axiosRetry = require('axios-retry')
axiosRetry(axios, { retries: 5, retryDelay: axiosRetry.exponentialDelay })
axios.defaults.headers.common.Authorization = `Bearer ${process.env.SSO_SCIM_TOKEN}`

// AWS SSO SCIM URL
const awsSsoScimUrl = `https://scim.${process.env.SSO_AWS_REGION}.amazonaws.com/${process.env.SSO_TENANT_ID}/scim/v2`

const utilities = {
  /*
    GitHub organisation members -> AWS SSO users
  */
  async githubGetOrgMembers () {
    /*
      Get all GitHub Organisation members usernames in lowercase
    */
    return octokit.paginate(octokit.orgs.listMembers, {
      org: process.env.GITHUB_ORGANISATION
    }).then(members => members.map(member => member.login.toLowerCase()))
  },
  async ssoGetMemberByDisplayName (member) {
    /*
      Check if a user exists in AWS SSO based on their username
    */
    const url = `${awsSsoScimUrl}/Users?filter=userName eq "${member}"`
    return axios.get(url).then(response => response.data.totalResults === 1)
  },
  async reconcileMembers (github) {
    /*
      Check whether all the GitHub users exist in AWS SSO

      This Lambda doesn't implement flagging for deletion of users, yet.

      The ListUsers API endpoint in AWS SSO doesn't respect a startIndex, so we can't paginate
      through the results. Therefore, we have to call the API everytime we want to check if a user exists,
      based on it's displayName, using the ListUsers endpoint.
      See: https://docs.aws.amazon.com/singlesignon/latest/developerguide/listusers.html
    */
    const status = []
    for (const member of github) {
      const username = member + process.env.SSO_EMAIL_SUFFIX
      const existsInSSO = await utilities.ssoGetMemberByDisplayName(username)
      status.push({
        name: username,
        existsInSSO: existsInSSO
      })
    }

    return {
      create: status.filter(member => !member.existsInSSO),
      delete: []
    }
  },
  async syncMembers (members) {
    /*
      Sync GitHub users that don't exist into AWS SSO.

      It configures each user with every field set to their GitHub username + email suffix, e.g. "username@example.com"

      This Lambda doesn't implement the deletion of users, yet.
    */
    if (members.create.length) {
      for (const member of members.create) {
        const userObject = {
          userName: member.name,
          name: {
            familyName: member.name,
            givenName: member.name
          },
          displayName: member.name,
          active: true,
          emails: [
            {
              value: member.name,
              type: 'work',
              primary: true
            }
          ]
        }
        await axios.post(`${awsSsoScimUrl}/Users`, userObject).then(() => {
          console.log(`[info] Member: ${member.name} created.`)
        }).catch(error => {
          console.log(`[error] Member: ${member.name} not created:`, error)
        })
      }
    } else {
      console.log('[info] No members to create in AWS SSO.')
    }
  },
  /*
    GitHub organisation teams -> AWS SSO groups
  */
  async githubGetGroups () {
    /*
      Get all GitHub team slugs in an organisation
    */
    return octokit.paginate(octokit.teams.list, {
      org: process.env.GITHUB_ORGANISATION
    }).then(groups => groups.map(group => group.slug))
  },
  async ssoGetGroupByDisplayName (group) {
    /*
      Check if a GitHub team already exists in AWS SSO
    */
    const url = `${awsSsoScimUrl}/Groups?filter=displayName eq "${group}"`
    return axios.get(url).then(response => response.data.totalResults === 1)
  },
  async reconcileGroups (github) {
    /*
      Check whether all the GitHub teams exist in AWS SSO

      This Lambda doesn't implement flagging for deletion of teams, yet.

      The ListGroups API endpoint in AWS SSO doesn't respect a startIndex, so we can't paginate
      through the results. Therefore, we have to call the API everytime we want to check if a group exists,
      based on it's displayName, using the ListGroups endpoint.
      See: https://docs.aws.amazon.com/singlesignon/latest/developerguide/listgroups.html
    */
    const status = []
    for (const group of github) {
      const existsInSSO = await utilities.ssoGetGroupByDisplayName(group)
      status.push({
        name: group,
        existsInSSO: existsInSSO
      })
    }

    return {
      create: status.filter(group => !group.existsInSSO),
      delete: []
    }
  },
  async syncGroups (groups) {
    /*
      Sync GitHub teams that don't exist into AWS SSO.

      This Lambda doesn't implement the deletion of teams, yet.
    */
    if (groups.create.length) {
      for (const group of groups.create) {
        const groupObject = {
          displayName: group.name
        }
        await axios.post(`${awsSsoScimUrl}/Groups`, groupObject).then(() => {
          console.log(`[info] Group: ${group.name} was created.`)
        }).catch(error => {
          console.log(`[error] Group: ${group.name} not created:`, error)
        })
      }
    } else {
      console.log('[info] No groups to create.')
    }
  }
}

module.exports = utilities
