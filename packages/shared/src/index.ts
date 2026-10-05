import { v7 } from 'uuid';
import { z } from 'zod';
export { supabaseConfiguration } from './supabase-configuration.js';

export const idSchema = z.uuid({ version: 'v7' });
export const utcTimestampSchema = z.iso.datetime({ offset: false });
export const dateOnlySchema = z.iso.date();
export type EntityId = z.infer<typeof idSchema>;
export type UtcTimestamp = z.infer<typeof utcTimestampSchema>;
export const newId = (): EntityId => v7();
export const utcNow = (): UtcTimestamp => new Date().toISOString();
export type PocError = { code: string; message: string; retryable: boolean };
