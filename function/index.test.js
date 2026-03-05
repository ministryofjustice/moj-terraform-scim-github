import { test, expect, describe, jest } from '@jest/globals'

import { handler, scimGitHubToAWSIdentityStore } from './index.js'

const originalEnv = process.env

const mockProcessEnv = () => {
  return {
    ...originalEnv,
    GITHUB_ORGANISATION: 'test_organisation',
    GITHUB_APP_ID: 'test_appid',
    GITHUB_APP_PRIVATE_KEY: 'test_private_key',
    GITHUB_APP_INSTALLATION_ID: 'test_installation_id',
    SSO_AWS_REGION: 'test_region',
    SSO_EMAIL_SUFFIX: '@test_email_suffix',
    SSO_IDENTITY_STORE_ID: 'test_identity_store_id',
  }
}

export const createMockOctokit = ({
  teams = [],
} = {}) => {
  return {
    graphql: {
      paginate: jest.fn().mockResolvedValue({
        organization: {
          teams: {
            nodes: teams.map((t) => ({
              slug: t.slug,
              members: {
                nodes: (t.members ?? []).map((login) => ({ login })),
                pageInfo: { hasNextPage: false },
              },
            })),
          },
        },
      }),
    },
  }
}

export const createMockIdentitystoreClient = ({
  identitystore,
  membershipsByGroupId = {},
  listGroupMembershipsFirst = [],
  listGroupMembershipsSecond = [],
} = {}) => {
  let callListGroupMembershipsCommandCount = 0
  return {
    send: jest.fn(async (command) => {
      if (command instanceof identitystore.ListGroupMembershipsCommand) {
        const groupId = command.input?.GroupId
        if (groupId && groupId in membershipsByGroupId) {
          return {
            GroupMemberships: membershipsByGroupId[groupId].map((m) => ({
              MemberId: { UserId: m.userId },
              MembershipId: m.membershipId,
            })),
          }
        }

        callListGroupMembershipsCommandCount++
        if (callListGroupMembershipsCommandCount === 1)
          return {
            GroupMemberships: listGroupMembershipsFirst.map((m) => ({
              MemberId: { UserId: m.userId },
              MembershipId: m.membershipId,
            })),
          }
        if (callListGroupMembershipsCommandCount === 2)
          return {
            GroupMemberships: listGroupMembershipsSecond.map((m) => ({
              MemberId: { UserId: m.userId },
              MembershipId: m.membershipId,
            })),
          }

        fail('ListGroupMembershipsCommand has been called too many times!')
      }
      return {}
    }),
  }
}


export const createMockIdentitystore = ({
  awsUsersFirst = [],
  awsUsersSecond = [],
  awsGroupsFirst = [],
  awsGroupsSecond = [],
} = {}) => {
  class CreateGroupCommand {
    constructor(parameters) {
      this.input = parameters
    }
  }

  class CreateGroupMembershipCommand {
    constructor(parameters) {
      this.input = parameters
    }
  }

  class DeleteGroupCommand {
    constructor(parameters) {
      this.input = parameters
    }
  }

  class CreateUserCommand {
    constructor(parameters) {
      this.input = parameters
    }
  }

  class DeleteUserCommand {
    constructor(parameters) {
      this.input = parameters
    }
  }

  class DeleteGroupMembershipCommand {
    constructor(parameters) {
      this.input = parameters
    }
  }

  class ListGroupMembershipsCommand {
    constructor(parameters) {
      this.input = parameters
    }
  }

  let callPaginateListUsersCount = 0
  let callPaginateListGroupsCount = 0

  return {
    IdentitystoreClient: class { },
    CreateGroupCommand,
    CreateGroupMembershipCommand,
    CreateUserCommand,
    DeleteGroupCommand,
    DeleteGroupMembershipCommand,
    DeleteUserCommand,
    ListGroupMembershipsCommand,
    paginateListUsers: jest.fn(() =>
      (async function*() {
        callPaginateListUsersCount++
        if (callPaginateListUsersCount === 1)
          yield {
            Users: awsUsersFirst.map((u) => ({
              UserName: u.name,
              UserId: u.userId,
              Emails: u.Emails ?? [],
            })),
          }
        if (callPaginateListUsersCount === 2)
          yield {
            Users: awsUsersSecond.map((u) => ({
              UserName: u.name,
              UserId: u.userId,
              Emails: u.Emails ?? [],
            })),
          }
      })(),
    ),
    paginateListGroups: jest.fn(() =>
      (async function*() {
        callPaginateListGroupsCount++
        if (callPaginateListGroupsCount === 1)
          yield {
            Groups: awsGroupsFirst.map((g) => ({ DisplayName: g, GroupId: g })),
          }
        if (callPaginateListGroupsCount === 2)
          yield {
            Groups: awsGroupsSecond.map((g) => ({ DisplayName: g, GroupId: g })),
          }

      })(),
    ),
  }
}


describe('scimGitHubToAWSIdentityStore', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = mockProcessEnv()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('creates users, groups and memberships that exist in GitHub and do not exist in Identity Store', async () => {
    const mockOctokit = createMockOctokit({
      teams: [{ slug: 'test-team-0', members: ['test-user-0'] }, { slug: 'test-team-1', members: ['test-user-1'] }],
    })
    const mockIdentitystore = createMockIdentitystore({
      awsGroupsFirst: ['test-team-0'], // group missing
      awsUsersFirst: [{ name: 'test-user-0', userId: 'test-user-0-userId' }],  // user missing
      // 👇 Second calls are after the users and groups are creted in IdentityStore
      awsGroupsSecond: ['test-team-0', 'test-team-1'],
      awsUsersSecond: [{ name: 'test-user-0', userId: 'test-user-0-userId' }, { name: 'test-user-1', userId: 'test-user-1-userId' }],
    })
    const mockIdentitystoreClient = createMockIdentitystoreClient({
      identitystore: mockIdentitystore,
      listGroupMembershipsFirst: [{ userId: 'test-user-0-userId', membershipId: 'test-user-0-membershipId' }],
      listGroupMembershipsSecond: [], // missing membership on newly created group
    })

    await scimGitHubToAWSIdentityStore({
      octokit: mockOctokit,
      identitystore: mockIdentitystore,
      identitystoreClient: mockIdentitystoreClient,
      gitHubTeamsIgnoreList: [],
      dryrun: false
    })

    // Expect that the group will be created first
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(1, expect.any(mockIdentitystore.CreateGroupCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          DisplayName: 'test-team-1',
          IdentityStoreId: 'test_identity_store_id',
        }),
      }),
    )

    // Expect that the user will be created second
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(2, expect.any(mockIdentitystore.CreateUserCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: {
          DisplayName: "test-user-1@test_email_suffix",
          Emails: [{ Primary: true, Type: 'work', Value: "test-user-1@test_email_suffix" }],
          IdentityStoreId: "test_identity_store_id",
          Name: { FamilyName: "test-user-1@test_email_suffix", GivenName: "test-user-1@test_email_suffix" },
          UserName: "test-user-1@test_email_suffix"
        }
      }),
    )

    // Expect that ListGroupMembershipsCommand will be called for the number of groups in IdentityStore (2 in this case)
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(3, expect.any(mockIdentitystore.ListGroupMembershipsCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        input: {
          GroupId: undefined,
          IdentityStoreId: 'test_identity_store_id'
        }
      }
      ),
    )
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(4, expect.any(mockIdentitystore.ListGroupMembershipsCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        input: {
          GroupId: undefined,
          IdentityStoreId: 'test_identity_store_id'
        }
      }
      ),
    )

    // Finally, expect that the user will be added to the group (completing the SCIM)
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(5, expect.any(mockIdentitystore.CreateGroupMembershipCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        input: {
          GroupId: undefined,
          IdentityStoreId: 'test_identity_store_id',
          MemberId: { UserId: 'test-user-1-userId' }
        }
      }),
    )

    expect(mockIdentitystoreClient.send).toHaveBeenCalledTimes(5)

  })

  it('deletes users, groups and memberships that exist in Identity Store and do not exist in GitHub', async () => {
    const mockOctokit = createMockOctokit({
      teams: [{ slug: 'test-team-0', members: ['test-user-0'] }], // missing team in GitHub
    })
    const mockIdentitystore = createMockIdentitystore({
      awsGroupsFirst: ['test-team-0', 'test-team-1'],
      awsUsersFirst: [{ name: 'test-user-0', userId: 'test-user-0-userId' }, { name: 'test-user-1', userId: 'test-user-1-userId' }],
      // 👇 Second calls are after the users and groups are deleted in IdentityStore
      awsGroupsSecond: ['test-team-0'],
      awsUsersSecond: [{ name: 'test-user-0', userId: 'test-user-0-userId' }],
    })
    const mockIdentitystoreClient = createMockIdentitystoreClient({
      identitystore: mockIdentitystore,
      listGroupMembershipsFirst: [{ userId: 'test-user-0-userId', membershipId: 'test-user-0-membershipId' }, { userId: 'test-user-1-userId', membershipId: 'test-user-1-membershipId' }],
      listGroupMembershipsSecond: [], // only one group so this shouldn't be called
    })

    await scimGitHubToAWSIdentityStore({
      octokit: mockOctokit,
      identitystore: mockIdentitystore,
      identitystoreClient: mockIdentitystoreClient,
      gitHubTeamsIgnoreList: [],
      dryrun: false
    })

    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(1, expect.any(mockIdentitystore.DeleteGroupCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({ GroupId: undefined, IdentityStoreId: 'test_identity_store_id' })
      }))

    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(2, expect.any(mockIdentitystore.DeleteUserCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: { IdentityStoreId: 'test_identity_store_id', UserId: 'test-user-1-userId' }
      }),
    )

    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(3, expect.any(mockIdentitystore.ListGroupMembershipsCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        input: { IdentityStoreId: 'test_identity_store_id', UserId: undefined }
      }),
    )

    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(4, expect.any(mockIdentitystore.DeleteGroupMembershipCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        input: { IdentityStoreId: 'test_identity_store_id', MembershipId: 'test-user-1-membershipId' }
      }),
    )

    expect(mockIdentitystoreClient.send).toHaveBeenCalledTimes(4)

  })

  it('Ignores users, groups and memberships that exist in Identity Store and exist in GitHub', async () => {
    const mockOctokit = createMockOctokit({
      teams: [{ slug: 'test-team-0', members: ['test-user-0'] }],
    })
    const mockIdentitystore = createMockIdentitystore({
      awsGroupsFirst: ['Test-team-0'],
      awsUsersFirst: [{ name: 'Test-user-0@test_email_suffix', userId: 'test-user-0-userId' }],
      awsGroupsSecond: ['Test-team-0'],
      awsUsersSecond: [{ name: 'Test-user-0@test_email_suffix', userId: 'test-user-0-userId' }],
    })
    const mockIdentitystoreClient = createMockIdentitystoreClient({
      identitystore: mockIdentitystore,
      listGroupMembershipsFirst: [{ userId: 'test-user-0-userId', membershipId: 'test-user-0-membershipId' }],
      listGroupMembershipsSecond: [], // only one group so this shouldn't be called
    })


    await scimGitHubToAWSIdentityStore({
      octokit: mockOctokit,
      identitystore: mockIdentitystore,
      identitystoreClient: mockIdentitystoreClient,
      gitHubTeamsIgnoreList: [],
      dryrun: false
    })

    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(1, expect.any(mockIdentitystore.ListGroupMembershipsCommand))
    expect(mockIdentitystoreClient.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: { IdentityStoreId: "test_identity_store_id", UserId: undefined }
      }),
    )
    expect(mockIdentitystoreClient.send).toHaveBeenCalledTimes(1)
  })
})

describe('handler', () => {
  it('throws an error when missing environment variables', async () => {
    await expect(handler()).rejects.toThrow(
      new Error(
        'Missing variables: GITHUB_ORGANISATION, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID, SSO_AWS_REGION, SSO_EMAIL_SUFFIX, SSO_IDENTITY_STORE_ID',
      ),
    )
  })
})
