import { Injectable, NotFoundException } from '@nestjs/common';
import { User, CreateUserData, UpdateUserData } from './entities/user.types.js';
import * as bcrypt from 'bcryptjs';
import { UserYdbRepository } from './user.repository.js';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserYdbRepository) {}

  // ===== Публичные методы для чтения (без пароля) =====
  async findUserById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async findUserByEmail(
    email: string,
  ): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async findAll(params: {
    limit?: number;
    offset?: number;
    filter?: { email?: string; firstName?: string; lastName?: string };
    orderBy?: 'created_at' | 'first_name' | 'last_name' | 'email';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<{ rows: Omit<User, 'passwordHash'>[]; total: number }> {
    const result = await this.userRepository.findAll(
      params.limit ?? 100,
      params.offset ?? 0,
      params.filter,
      params.orderBy ?? 'created_at',
      params.orderDir ?? 'DESC',
    );
    return {
      rows: result.rows.map(({ passwordHash, ...rest }) => rest),
      total: result.total,
    };
  }

  // ============================================================
  //  СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ (хэш НЕ вычисляется)
  // ============================================================
  async createUser(
    createData: Omit<CreateUserData, 'passwordHash'>,
  ): Promise<Omit<User, 'passwordHash'>> {
    // Проверка уникальности email НЕ нужна – репозиторий сам бросит DbUniqueViolationException
    const user = await this.userRepository.createUser(createData);
    const { passwordHash, ...rest } = user;
    return rest;
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ ДАННЫХ (хэш НЕ вычисляется)
  // ============================================================
  async updateUser(data: UpdateUserData): Promise<Omit<User, 'passwordHash'>> {
    // Проверка уникальности email НЕ нужна – репозиторий сам бросит DbUniqueViolationException
    const updated = await this.userRepository.updatePartial(data);
    if (!updated) {
      throw new NotFoundException(`User with id ${data.id} not found`);
    }
    const { passwordHash, ...rest } = updated;
    return rest;
  }

  // ============================================================
  //  ВНУТРЕННИЕ МЕТОДЫ (с хэшем)
  // ============================================================
  async findUserByIdWithPasswordHash(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  private async findUserByEmailWithPasswordHash(
    email: string,
  ): Promise<User | null> {
    return this.userRepository.findByEmailWithPasswordHash(email);
  }

  // ============================================================
  //  АУТЕНТИФИКАЦИЯ
  // ============================================================
  async validateUserCredentials(
    credentials:
      | { email: string; password: string }
      | { id: string; password: string },
  ): Promise<Omit<User, 'passwordHash'> | null> {
    let user: User | null = null;
    if ('email' in credentials) {
      user = await this.findUserByEmailWithPasswordHash(credentials.email);
    } else {
      user = await this.findUserByIdWithPasswordHash(credentials.id);
    }

    if (user?.passwordHash) {
      const isValid = await bcrypt.compare(
        credentials.password,
        user.passwordHash,
      );
      if (isValid) {
        const { passwordHash, ...rest } = user;
        return rest;
      }
    }
    return null;
  }

  // ============================================================
  //  СМЕНА ПАРОЛЯ
  // ============================================================
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    const user = await this.findUserByIdWithPasswordHash(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    if (!user.passwordHash) {
      return false;
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return false;

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const updateData: UpdateUserData = {
      id: userId,
      passwordHash: newPasswordHash,
    };
    const updated = await this.userRepository.updatePartial(updateData);
    return !!updated;
  }

  // ============================================================
  //  УДАЛЕНИЕ
  // ============================================================
  async deleteUser(id: string): Promise<void> {
    const deleted = await this.userRepository.remove(id);
    if (!deleted) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }
}
