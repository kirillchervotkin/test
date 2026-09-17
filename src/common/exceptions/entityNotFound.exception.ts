export class EntityNotFoundException extends Error {
  constructor(
    public readonly entityName: string,
    public readonly entityId: number,
  ) {
    super(`${entityName} with ID ${entityId} not found`);
    this.name = 'EntityNotFoundException';
  }
}
