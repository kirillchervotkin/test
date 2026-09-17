// src/auth/decorators/user-id.decorator.ts
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestWithUser } from '../interfaces/requestWithUser.interface.js';

export const UserId = createParamDecorator<string>(
  (_: unknown, ctx: ExecutionContext): string => {
    const request: RequestWithUser = ctx.switchToHttp().getRequest();
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return userId;
  },
);
