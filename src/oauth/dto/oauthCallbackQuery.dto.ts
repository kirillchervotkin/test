import { IsString } from 'class-validator';

export class OauthCallbackQueryDto {
  @IsString()
  code: string;

  @IsString()
  state: string;
}
