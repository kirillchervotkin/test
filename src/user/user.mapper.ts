// src/user/user.mapper.ts
import { User, CreateUserData, UpdateUserData } from './entities/user.types.js';
import { UserWithoutExcludedDto } from './dto/userWithoutExcluded.dto.js';
import { CreateUserDto } from './dto/createUserWithotPassword.dto.js';
import { UpdateUserDto } from './dto/updateUser.dto.js';

export class UserMapper {
  static toDto(user: Omit<User, 'passwordHash'>): UserWithoutExcludedDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      birthDate: user.birthDate
        ? user.birthDate.toISOString().slice(0, 10)
        : null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toCreateUserData(
    dto: CreateUserDto,
  ): Omit<CreateUserData, 'passwordHash'> {
    return {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      birthDate: dto.birthDate
        ? new Date(dto.birthDate + 'T00:00:00Z')
        : undefined,
    };
  }

  static toUpdateUserData(id: string, dto: UpdateUserDto): UpdateUserData {
    const data: UpdateUserData = { id };
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate
        ? new Date(dto.birthDate + 'T00:00:00Z')
        : null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return data;
  }
}
