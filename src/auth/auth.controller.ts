import {
  Controller,
  Post,
  UseGuards,
  Body,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { SignInDto } from './dto/singIn.dto.js';
import { RefreshTokenDto } from './dto/refreshToken.dto.js';
import { SignUpDto } from './dto/signUp.dto.js';
import { CreateActivationUrlDto } from './dto/createActivationUrl.dto.js';
import { UserService } from '../user/user.service.js';
import { JwtAuthGuard } from './guards/auth.guard.js';
import { UserId } from './decorators/user-id.decorator.js';
import { ChangePasswordDto } from './dto/changePassword.dto.js';

class TokenPairResponse {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;
}

class MessageResponse {
  @ApiProperty({ example: 'Пароль успешно изменен' })
  message: string;
}

class ActivationUrlResponse {
  @ApiProperty({ description: 'URL для активации пользователя' })
  activationUrl: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @ApiBearerAuth()
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Изменение пароля',
    description: 'Изменение пароля для авторизованного пользователя',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Пароль успешно изменен',
    type: MessageResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Неверный текущий пароль или пользователь не авторизован',
  })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
  async changePassword(
    @UserId() userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(userId, changePasswordDto);
    return { message: 'Пароль успешно изменен' };
  }

  @Post('signup')
  @ApiOperation({
    summary: 'Регистрация пользователя',
    description:
      'Завершение регистрации пользователя с использованием кода активации',
  })
  @ApiBody({ type: SignUpDto })
  @ApiResponse({
    status: 201,
    description: 'Пользователь успешно зарегистрирован',
    type: TokenPairResponse,
  })
  @ApiNotFoundResponse({
    description: 'Невалидный код активации или пользователь не найден',
  })
  @ApiConflictResponse({
    description: 'Пользователь с таким email уже существует',
  })
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Post('signin')
  @ApiOperation({
    summary: 'Вход в систему',
    description: 'Аутентификация пользователя по email и паролю',
  })
  @ApiBody({ type: SignInDto })
  @ApiResponse({
    status: 200,
    description: 'Успешная аутентификация',
    type: TokenPairResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Неверные учетные данные' })
  async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Обновление токенов',
    description: 'Обновление access и refresh токенов',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Токены успешно обновлены',
    type: TokenPairResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Невалидный refresh токен' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('activation-url')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Создание ссылки активации',
    description:
      'Генерация URL для активации пользователя (требует аутентификации)',
  })
  @ApiBody({ type: CreateActivationUrlDto })
  @ApiResponse({
    status: 200,
    description: 'URL активации успешно создан',
    type: ActivationUrlResponse,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  async createActivationUrl(
    @Body() createActivationUrlDto: CreateActivationUrlDto,
  ): Promise<{ activationUrl: string }> {
    const user = await this.userService.findUserById(
      createActivationUrlDto.userId,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      activationUrl: await this.authService.createActivationUrl(
        createActivationUrlDto.userId,
      ),
    };
  }
}
