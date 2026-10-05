export function privateSchemaName(schema: string) {
  if (!/^greiva_private_[a-z0-9_]{1,40}$/.test(schema)) throw new Error('Explicit private schema name required');
  return schema;
}
