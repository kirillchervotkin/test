import { Injectable, NotFoundException } from '@nestjs/common';
import { UserListYdbRepository } from './user-list.ydb.repository.js';
import {
  AssignListInput,
  UnassignListInput,
  User,
  UserList,
} from './user-list.types.js';

/**
 * Service for managing user-list relations.
 *
 * Wraps {@link UserListYdbRepository} and provides business-level operations.
 * Translates persistence-layer exceptions into appropriate NestJS exceptions
 * (see global exception filter for HTTP mapping).
 */
@Injectable()
export class UserListService {
  constructor(private readonly userListRepository: UserListYdbRepository) {}

  /**
   * Assigns a list to a user atomically.
   *
   * Delegates to {@link UserListYdbRepository.assignListToUserAtomic}, which
   * performs all checks (user existence, list existence, duplicate relation)
   * inside a serializable transaction.
   *
   * @throws {DbForeignKeyViolationException} if the user or list does not exist.
   *   Converted to an appropriate HTTP response by the global exception filter.
   * @throws {DbUniqueViolationException} if the relation already exists.
   *   Also converted to an HTTP response.
   * @param input - The user and list identifiers.
   * @returns The newly created {@link UserList} relation.
   */
  async assignListToUser(input: AssignListInput): Promise<UserList> {
    return this.userListRepository.assignListToUserAtomic(input);
  }

  /**
   * Removes a list from a user.
   *
   * The repository returns the deleted record or `null` if the relation
   * was not found. This method throws a {@link NotFoundException} when
   * no matching relation exists.
   *
   * @throws {NotFoundException} if the user-list relation does not exist.
   * @param input - The user and list identifiers.
   */
  async unassignListFromUser(input: UnassignListInput): Promise<void> {
    const deleted = await this.userListRepository.removeByUserAndList(
      input.userId,
      input.listId,
    );

    if (!deleted) {
      throw new NotFoundException('User-list relation not found');
    }
  }

  /**
   * Retrieves all list relations for a given user.
   *
   * Returns an empty array if the user has no assigned lists.
   *
   * @param userId - The user ID.
   * @returns An array of {@link UserList} objects.
   */
  async getUserLists(userId: string): Promise<UserList[]> {
    return this.userListRepository.findAllByUser(userId);
  }

  /**
   * Retrieves all users assigned to a given list.
   *
   * Returns an empty array if the list has no assigned users.
   *
   * @param listId - The list ID.
   * @returns An array of {@link User} objects.
   */
  async findUsersByList(listId: string): Promise<User[]> {
    return this.userListRepository.findUsersByList(listId);
  }
}
