export class IdentityStoreService {
  constructor(identitystoreClient, identitystore, dryrun) {
    this.identitystoreClient = identitystoreClient
    this.identitystore = identitystore
    this.identityStoreId = process.env.SSO_IDENTITY_STORE_ID
    this.emailSuffix = process.env.SSO_EMAIL_SUFFIX
    this.groupPrefixForEntraIdGroups = 'azure-aws-sso-'
    this.emailTypeForEntraIdUsers = 'EntraId'
    this.dryrun = dryrun
  }

  async getIdentityStoreGroups() {
    const list = []

    for await (const page of this.identitystore.paginateListGroups(
      {
        client: this.identitystoreClient,
        pageSize: 100,
      },
      {
        IdentityStoreId: this.identityStoreId,
      },
    )) {
      let values = [...page['Groups']].map((group) => {
        return {
          id: group.GroupId,
          name: group.DisplayName.toLowerCase(),
        }
      })
      values = values.filter((group) => !this.isEntraIdGroup(group.name))
      list.push(...values)
    }

    return list
  }

  async getIdentityStoreUsers() {
    const list = []

    for await (const page of this.identitystore.paginateListUsers(
      {
        client: this.identitystoreClient,
        pageSize: 100,
      },
      {
        IdentityStoreId: this.identityStoreId,
        ...{ AttributesToGet: ['UserName', 'Emails'] },
      },
    )) {
      let values = [...page['Users']].map((user) => {
        return {
          id: user.UserId,
          name: user.UserName.replace(this.emailSuffix, '').toLowerCase(),
          Emails: user.Emails,
        }
      })
      list.push(...values)
    }

    return list
  }

  async getIdentityStoreGroupMembershipsPageWithRetries(
    groupId,
    nextToken,
    maxRetries = 3,
  ) {
    let response
    for (let attempt = 0; ; attempt++) {
      try {
        console.log(
          `Fetching group memberships for group ${groupId}, attempt ${attempt + 1} of ${maxRetries}...`,
        )
        response = await this.identitystoreClient.send(
          new this.identitystore.ListGroupMembershipsCommand({
            IdentityStoreId: this.identityStoreId,
            GroupId: groupId,
            ...(nextToken ? { NextToken: nextToken } : {}),
          }),
        )
        return response
      } catch (err) {
        console.warn(
          `Error fetching group memberships for group ${groupId} on attempt ${attempt + 1} of ${maxRetries}:`,
          err,
        )
        const throttled =
          err?.name === 'ThrottlingException' ||
          err?.name === 'TooManyRequestsException' ||
          err?.$metadata?.httpStatusCode === 429

        if (!throttled || attempt >= maxRetries) throw err

        const retryAfterSeconds = Number(err?.RetryAfterSeconds)
        if (!retryAfterSeconds) {
          console.error(
            `Request throttled but no Retry-After header found. Attempt ${attempt + 1} of ${maxRetries}.`,
          )
          throw err // no AWS-provided wait time
        }

        await new Promise((resolve) =>
          setTimeout(resolve, retryAfterSeconds * 1000),
        )
      }
    }
  }

  async getIdentityStoreGroupMemberships(groupId, maxRetries = 3) {
    console.log(
      `Fetching group memberships for group ${groupId} with up to ${maxRetries} retries on throttling...`,
    )
    let response
    let memberships = []
    do {
      response = await this.getIdentityStoreGroupMembershipsPageWithRetries(
        groupId,
        response?.NextToken,
        maxRetries,
      )
      memberships = memberships.concat(
        response.GroupMemberships.map((membership) => ({
          userId: membership.MemberId.UserId,
          membershipId: membership.MembershipId,
        })),
      )
    } while (response?.NextToken)

    return memberships
  }

  async createGroup(displayName) {
    if (this.dryrun) {
      console.log(`[dry-run] would create group ${displayName}`)
      return
    }
    console.log(`creating group ${displayName}`)
    try {
      return this.identitystoreClient.send(
        new this.identitystore.CreateGroupCommand({
          DisplayName: displayName,
          IdentityStoreId: this.identityStoreId,
        }),
      )
    } catch (error) {
      console.error(error)
    }
  }

  async createUser(displayName) {
    if (this.dryrun) {
      console.log(
        `[dry-run] would create user ${displayName}${this.emailSuffix}`,
      )
      return
    }
    console.log(`creating user ${displayName}${this.emailSuffix}`)
    const name = `${displayName}${this.emailSuffix}`
    try {
      return this.identitystoreClient.send(
        new this.identitystore.CreateUserCommand({
          UserName: name,
          DisplayName: name,
          Name: {
            FamilyName: name,
            GivenName: name,
          },
          Emails: [
            {
              Primary: true,
              Type: 'work',
              Value: name,
            },
          ],
          IdentityStoreId: this.identityStoreId,
        }),
      )
    } catch (error) {
      console.error(error)
    }
  }

  async createGroupMembership(groupId, userId) {
    if (this.dryrun) {
      console.log(
        `[dry-run] would create group membership for user ${userId} in group ${groupId}`,
      )
      return
    }
    console.log(
      `creating group membership for user ${userId} in group ${groupId}`,
    )
    try {
      return this.identitystoreClient.send(
        new this.identitystore.CreateGroupMembershipCommand({
          GroupId: groupId,
          MemberId: {
            UserId: userId,
          },
          IdentityStoreId: this.identityStoreId,
        }),
      )
    } catch (error) {
      console.error(error)
    }
  }

  async deleteGroup(groupId, groupName) {
    if (this.isEntraIdGroup(groupName)) {
      console.debug(`Skipping deletion of EntraID Group: ${groupName}`)
      return
    }

    if (this.dryrun) {
      console.log(`[dry-run] would delete group ${groupId}`)
      return
    }
    console.log(`deleting group ${groupId}`)
    try {
      return this.identitystoreClient.send(
        new this.identitystore.DeleteGroupCommand({
          GroupId: groupId,
          IdentityStoreId: this.identityStoreId,
        }),
      )
    } catch (error) {
      console.error(error)
    }
  }

  async deleteUser(userId, emails) {
    if (
      emails &&
      emails.some((email) => email.Type === this.emailTypeForEntraIdUsers)
    ) {
      console.debug(
        `Skipping deletion EntraID User: ${emails.map((email) => email.Value).join(', ')}`,
      )
      return
    }

    if (this.dryrun) {
      console.log(`[dry-run] would delete user ${userId}`)
      return
    }
    console.log(`deleting user ${userId}`)
    try {
      return this.identitystoreClient.send(
        new this.identitystore.DeleteUserCommand({
          UserId: userId,
          IdentityStoreId: this.identityStoreId,
        }),
      )
    } catch (error) {
      console.error(error)
    }
  }

  async deleteGroupMembership(membershipId) {
    if (this.dryrun) {
      console.log(`[dry-run] would delete membership ${membershipId}`)
      return
    }
    console.log(`deleting membership ${membershipId}`)
    try {
      return this.identitystoreClient.send(
        new this.identitystore.DeleteGroupMembershipCommand({
          MembershipId: membershipId,
          IdentityStoreId: this.identityStoreId,
        }),
      )
    } catch (error) {
      console.error(error)
    }
  }

  isEntraIdGroup(groupName) {
    return groupName && groupName.startsWith(this.groupPrefixForEntraIdGroups)
  }

  decorateGroupMembershipWithUserDetailsAndGroupDetails(
    groupMemberships,
    users,
    group,
  ) {
    return groupMemberships.map((membership) => {
      const user = users.find((user) => user.id === membership.userId)

      return {
        ...user,
        membershipId: membership.membershipId,
        group: group,
      }
    })
  }

  async getGroupMembershipsWithUserAndGroupDetails(groupId, users, group) {
    const groupMemberships =
      await this.getIdentityStoreGroupMemberships(groupId)
    return this.decorateGroupMembershipWithUserDetailsAndGroupDetails(
      groupMemberships,
      users,
      group,
    )
  }
}
