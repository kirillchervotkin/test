import { Expose, Type } from 'class-transformer';
import { IsDate, IsString, IsUUID } from 'class-validator';

export class List {
  @Expose({ name: 'id' })
  @IsUUID()
  id: string;

  @Expose({ name: 'name' })
  @IsString()
  name: string;

  @Expose({ name: 'created_at' })
  @Type(() => Date)
  @IsDate()
  createdAt: Date;

  @Expose({ name: 'updated_at' })
  @Type(() => Date)
  @IsDate()
  updatedAt: Date;
}

/** Данные для создания нового списка */
export type CreateListData = Pick<List, 'name'>;
