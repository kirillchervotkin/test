import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtConfig } from './interfaces/jwtConfig.interface.js';
import { UserService } from '../user/user.service.js';
import { UpdateUserData } from '../user/entities/user.types.js';
import { SignUpDto } from './dto/signUp.dto.js';
import { SignInDto } from './dto/singIn.dto.js';
import { TokenPair } from './interfaces/tokenPair.interface.js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Payload } from './interfaces/payload.interface.js';
import { ChangePasswordDto } from './dto/changePassword.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @Inject('JWT_CONFIG') private jwtConfig: JwtConfig,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('FRONTEND_URL') private frontendUrl: string,
  ) {}

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    // Теперь метод публичный и возвращает User (с хешем)
    const user = await this.userService.findUserByIdWithPasswordHash(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.passwordHash!,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Incorrect current password');
    }

    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );
    // Обновляем только пароль
    const updateData: UpdateUserData = {
      id: userId,
      passwordHash: newPasswordHash,
    };
    await this.userService.updateUser(updateData);
  }

  async signUp(userDto: SignUpDto): Promise<TokenPair> {
    const userId: string | undefined = await this.cacheManager.get<string>(
      userDto.activationCode,
    );
    if (!userId) {
      throw new NotFoundException('Invalid activation code');
    }

    // findUserById возвращает без пароля – достаточно
    const userToActivate = await this.userService.findUserById(userId);
    if (!userToActivate) {
      throw new NotFoundException('User not found');
    }

    // Проверка на существующий email (возвращает без пароля)
    const existingUser = await this.userService.findUserByEmail(userDto.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(userDto.password, 10);
    // Собираем данные для обновления (приводим к UpdateUserData)
    const updateData: UpdateUserData = {
      id: userId,
      email: userDto.email,
      birthDate: userDto.birthDate ? new Date(userDto.birthDate) : null,
      passwordHash: passwordHash,
      isActive: true,
    };

    await this.userService.updateUser(updateData);
    await this.cacheManager.del(userDto.activationCode);

    const payload = { sub: userId, email: userDto.email };
    return await this.generateTokens(payload);
  }

  async createActivationUrl(userId: string): Promise<string> {
    const activationCode: string = randomBytes(32).toString('hex');
    const ttl: number = 60 * 60 * 24;
    await this.cacheManager.set<string>(activationCode, userId, ttl);
    return `${this.frontendUrl}/activate?activationCode=${activationCode}`;
  }

  async signIn(signInDto: SignInDto): Promise<TokenPair> {
    // validateUserCredentials возвращает Omit<User, 'passwordHash'> | null
    const user = await this.userService.validateUserCredentials({
      email: signInDto.email,
      password: signInDto.password,
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user.id, email: user.email! };
    return await this.generateTokens(payload);
  }

  private async generateTokens(payload: {
    sub: string;
    email: string;
  }): Promise<TokenPair> {
    return {
      access_token: await this.jwtService.signAsync(payload, {
        secret: this.jwtConfig.accessSecret,
        expiresIn: this.jwtConfig.accessExpiration,
      }),
      refresh_token: await this.jwtService.signAsync(payload, {
        secret: this.jwtConfig.refreshSecret,
        expiresIn: this.jwtConfig.refreshExpiration,
      }),
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const payload: Payload = await this.jwtService.verifyAsync<Payload>(
        refreshToken,
        {
          secret: this.jwtConfig.refreshSecret,
        },
      );
      // findUserByEmail возвращает без пароля – достаточно
      const user = await this.userService.findUserByEmail(payload.email);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const newPayload = { sub: user.id, email: user.email! };
      return await this.generateTokens(newPayload);
    } catch (_error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
