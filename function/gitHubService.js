function generateQuery() {
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

export async function getGitHubOrganisationTeamsAndMemberships(
  gitHubTeamsIgnoreList,
  octokit,
) {
  const { organization } = await octokit.graphql.paginate(generateQuery(), {
    organization: process.env.GITHUB_ORGANISATION,
  })

  const teamsToProcess = organization.teams.nodes.filter(
    (team) => !gitHubTeamsIgnoreList.includes(team.slug),
  )

  // Handle teams with 100+ members by fetching additional member pages
  const teams = []
  for (const team of teamsToProcess) {
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
        cursor: cursor,
      })

      allMembers = [...allMembers, ...result.organization.team.members.nodes]
      hasNextPage = result.organization.team.members.pageInfo.hasNextPage
      cursor = result.organization.team.members.pageInfo.endCursor
    }

    teams.push({
      name: team.slug.toLowerCase(),
      members: allMembers.map((user) => {
        return {
          name: user.login.toLowerCase(),
        }
      }),
    })
  }

  const users = teams.flatMap((team) => {
    return team.members.map((member) => {
      return member.name
    })
  })

  return {
    teams: teams,
    users: [...new Set(users)].map((username) => {
      return {
        name: username.toLowerCase(),
      }
    }),
  }
}
