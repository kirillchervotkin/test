export class DbUniqueViolationException extends Error {
  public readonly fields: { dbField: string; value?: unknown }[];
  public readonly isComposite: boolean;
  public readonly constraintName?: string;

  constructor(
    fields: { dbField: string; value?: unknown }[],
    constraintName?: string,
  ) {
    const isComposite = fields.length > 1;
    super(isComposite ? 'Composite unique violation' : 'Unique violation');
    this.fields = fields;
    this.isComposite = isComposite;
    this.constraintName = constraintName;
  }
}
