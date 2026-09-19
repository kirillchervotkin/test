// oauth/dto/oauthCallbackQuery.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OauthCallbackQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  // state обязателен — Polar всегда его присылает,
  // и без него мы не сможем достать StateParams из кеша.
  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  error_description?: string;

  @IsOptional()
  @IsString()
  error_uri?: string;
}
