// trigger/dto/trigger-payload.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';

export class EventMetadataDto {
  @IsString()
  event_id!: string;

  @IsString()
  event_type!: string;

  @IsISO8601()
  created_at!: string;
}

export class TriggerMessageBodyDto {
  @IsString()
  message_id!: string;

  @IsString()
  body!: string;

  @IsObject()
  attributes!: Record<string, string>;
}

export class TriggerMessageDetailsDto {
  @IsString()
  queue_id!: string;

  @ValidateNested()
  @Type(() => TriggerMessageBodyDto)
  message!: TriggerMessageBodyDto;
}

export class TriggerMessageDto {
  @ValidateNested()
  @Type(() => EventMetadataDto)
  event_metadata!: EventMetadataDto;

  @ValidateNested()
  @Type(() => TriggerMessageDetailsDto)
  details!: TriggerMessageDetailsDto;
}

export class TriggerPayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TriggerMessageDto)
  messages!: TriggerMessageDto[];
}
