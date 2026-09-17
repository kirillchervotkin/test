import { IsOptional, IsString } from 'class-validator';

export class OauthCallbackQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  error_description?: string;
}
