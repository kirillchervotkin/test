import { Injectable, NotFoundException } from '@nestjs/common';
import { List } from './list.types.js';
import { ListYdbRepository } from './list.ydb.repository.js';

@Injectable()
export class ListService {
  constructor(private readonly listRepo: ListYdbRepository) {}

  async createList(name: string): Promise<List> {
    return this.listRepo.createList({ name });
  }

  async deleteList(id: string): Promise<void> {
    const deleted = await this.listRepo.remove(id);
    if (!deleted) {
      throw new NotFoundException(`List with id ${id} not found`);
    }
  }

  async getAllLists(): Promise<List[]> {
    return this.listRepo.findAll();
  }

  async getListById(id: string): Promise<List> {
    const list = await this.listRepo.findById(id);
    if (!list) {
      throw new NotFoundException(`List with id ${id} not found`);
    }
    return list;
  }

  async updateList(id: string, name: string): Promise<List> {
    const existing = await this.getListById(id);
    existing.name = name;
    const updated = await this.listRepo.update(existing);
    if (!updated) {
      throw new NotFoundException(`List with id ${id} not found`);
    }
    return updated;
  }
}
