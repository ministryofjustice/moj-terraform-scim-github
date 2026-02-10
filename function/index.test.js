import { test, expect, describe, jest } from '@jest/globals'

import { handler, scimGitHubToAWSIdentityStore } from './index.js'
describe('SCIM Job', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      GITHUB_ORGANISATION: 'test_organisation',
      GITHUB_APP_ID: 'test_appid',
      GITHUB_APP_PRIVATE_KEY: 'test_private_key',
      GITHUB_APP_INSTALLATION_ID: 'test_installation_id',
      SSO_AWS_REGION: '',
      SSO_EMAIL_SUFFIX: '',
      SSO_IDENTITY_STORE_ID: '',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('Smoke Test', async () => {
    const identitystore = {
      IdentitystoreClient: class {},
      CreateGroupCommand: class {},
      CreateGroupMembershipCommand: class {},
      CreateUserCommand: class {},
      DeleteGroupCommand: class {},
      DeleteGroupMembershipCommand: class {},
      DeleteUserCommand: class {},
      ListGroupMembershipsCommand: class {},
      paginateListUsers: jest.fn(() =>
        (async function* () {
          yield { Users: [] }
        })(),
      ),
      paginateListGroups: jest.fn(() =>
        (async function* () {
          yield { Groups: [] }
        })(),
      ),
    }

    const identitystoreClient = {
      send: jest.fn(),
    }

    const octokit = {
      graphql: {
        paginate: jest.fn().mockResolvedValue({
          organization: {
            teams: {
              nodes: [
                {
                  slug: '',
                  members: { nodes: [], pageInfo: { hasNextPage: false } },
                },
              ],
              members: { nodes: [] },
            },
          },
        }),
      },
    }

    await scimGitHubToAWSIdentityStore({
      octokit: octokit,
      identitystore: identitystore,
      identitystoreClient: identitystoreClient,
      gitHubTeamsIgnoreList: [],
    })
  })

  test('Throws error when missing environment variables', async () => {
    process.env = originalEnv

    await expect(handler()).rejects.toThrow(
      new Error(
        'Missing variables: GITHUB_ORGANISATION, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID, SSO_AWS_REGION, SSO_EMAIL_SUFFIX, SSO_IDENTITY_STORE_ID',
      ),
    )
  })
})
