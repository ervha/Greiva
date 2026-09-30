import { it, expect } from 'vitest';
import { newId, idSchema, utcNow, utcTimestampSchema } from '@greiva/shared';
it('STEP1-ID: creates unique, sortable UUID v7 IDs and UTC times', () => {
  const ids = Array.from({ length: 100 }, newId);
  expect(new Set(ids).size).toBe(100);
  expect(ids.every(id => idSchema.safeParse(id).success)).toBe(true);
  expect([...ids].sort()).toEqual(ids);
  expect(utcTimestampSchema.safeParse(utcNow()).success).toBe(true);
});
