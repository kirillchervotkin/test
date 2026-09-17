import { Exclude, Expose, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  IsISO8601,
} from 'class-validator';

/**
 * Пользователь (модель для ответов).
 * Все даты представлены как ISO-строки.
 */
@Exclude()
export class User {
  @Expose({ name: 'id' })
  @IsUUID()
  id: string;

  @Expose({ name: 'first_name' })
  @IsString()
  firstName: string;

  @Expose({ name: 'last_name' })
  @IsString()
  lastName: string;

  @Expose({ name: 'email' })
  @IsEmail()
  @IsOptional()
  email: string | null;

  @Expose({ name: 'birth_date' })
  @Transform(({ value }: { value: unknown }) => {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'string') {
      return value;
    }
    return null;
  })
  @IsISO8601({ strict: true })
  @IsOptional()
  birthDate: string | null;

  @Expose({ name: 'is_active' })
  @IsBoolean()
  isActive: boolean;

  @Expose({ name: 'created_at' })
  @Transform(({ value }: { value: unknown }) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value;
    }
    return null;
  })
  @IsISO8601({ strict: true })
  createdAt: string;

  @Expose({ name: 'updated_at' })
  @Transform(({ value }: { value: unknown }) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value;
    }
    return null;
  })
  @IsISO8601({ strict: true })
  updatedAt: string;
}

/**
 * Связь пользователя и списка (модель).
 */
export class UserList {
  @Expose({ name: 'id' })
  @IsUUID()
  id: string;

  @Expose({ name: 'user_id' })
  @IsUUID()
  userId: string;

  @Expose({ name: 'list_id' })
  @IsUUID()
  listId: string;
}

// Типы для входных данных
export type CreateUserListData = Pick<UserList, 'userId' | 'listId'>;

export interface AssignListInput {
  userId: string;
  listId: string;
}
export interface UnassignListInput {
  userId: string;
  listId: string;
}
