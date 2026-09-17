export interface ConstraintMessages {
  unique?: string;
  uniqueComposite?: string;
  foreignKey?: string;
  notNull?: string;
  check?: string;
}

export interface ConstraintOptions {
  dbField?: string;
  messages?: ConstraintMessages;
}

export interface ConstraintMetadata {
  dbField?: string;
  messages: ConstraintMessages;
}
