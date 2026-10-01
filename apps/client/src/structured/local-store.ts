import { invoke, isTauri } from '@tauri-apps/api/core';
import { newId } from '@greiva/shared';
import { parseOperationPayload, pushOperationSchema, pushResultSchema, pullResponseSchema, structuredSnapshotSchema } from '@greiva/protocol';
import type { StructuredStore } from '@greiva/sync';
export type LocalStructuredStore = StructuredStore;
export function localStructuredStore(): LocalStructuredStore | null {
  if (!isTauri() && import.meta.env.VITE_GREIVA_TEST_SQLITE !== '1') return null;
  const request = async <T>(command: string, fields: Record<string, unknown>): Promise<T> => {
    if (isTauri()) return invoke(command.replaceAll('-', '_'), fields);
    let device = localStorage.getItem('greiva-test-device');
    if (!device) { device = crypto.randomUUID(); localStorage.setItem('greiva-test-device', device); }
    const response = await fetch('/__greiva_test_store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device, command, ...fields }) });
    const reply = await response.json() as { value: T; error?: string };
    if (!response.ok || reply.error) throw new Error(reply.error ?? 'Test SQLite transport failed');
    return reply.value;
  };
  const initialized = request<string>('structured-client-id', { candidate: newId() });
  return {
    async snapshot() { await initialized; return structuredSnapshotSchema.parse(await request('structured-snapshot', {})); },
    async mutate(operation) {
      const parsed = pushOperationSchema.parse(operation); parseOperationPayload(parsed);
      const clientId = await initialized;
      if (parsed.clientId !== clientId) throw new Error('Local client identity mismatch');
      await request('structured-mutate', { operation: parsed });
    },
    async prepare() { await initialized; const wire = await request('structured-prepare',{}); return wire===null ? null : pushOperationSchema.parse(wire); },
    async acknowledge(result) { await initialized; await request('structured-ack',{result:pushResultSchema.parse(result)}); },
    async applyPull(baseCursor,batch) { await initialized; await request('structured-pull',{baseCursor,batch:pullResponseSchema.parse(batch)}); },
  };
}
