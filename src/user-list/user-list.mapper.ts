import { User, UserList } from './user-list.types.js';
import { UserListResponseDto } from './dto/user-list-response.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

/**
 * Mapper that converts {@link UserList} and {@link User} domain objects into DTOs for API responses.
 */
export class UserListMapper {
  /**
   * Formats a date value to an ISO string or returns null.
   * Supports Date objects, ISO strings, and null/undefined.
   *
   * @param value - The value to format (Date, string, null, undefined).
   * @returns ISO string or null.
   */

  /**
   * Maps a single user-list relation entity to its corresponding response DTO.
   */
  static toDto(relation: UserList): UserListResponseDto {
    return {
      id: relation.id,
      userId: relation.userId,
      listId: relation.listId,
    };
  }

  /**
   * Maps an array of user-list relation entities to an array of response DTOs.
   */
  static toDtoArray(relations: UserList[]): UserListResponseDto[] {
    return relations.map((rel) => this.toDto(rel));
  }

  /**
   * Maps a single user domain entity to its corresponding response DTO.
   * Safely converts Date fields to ISO strings; handles optional fields.
   */
  static toUserDto(user: User): UserResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email ?? null,
      birthDate: user.birthDate,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.createdAt,
    };
  }

  /**
   * Maps an array of user domain entities to an array of response DTOs.
   */
  static toUserDtoArray(users: User[]): UserResponseDto[] {
    return users.map((user) => this.toUserDto(user));
  }
}
