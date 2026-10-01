import { afterAll, beforeAll, it, expect } from 'vitest';
import { createServer } from '../../apps/collaboration/dist/server.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'greiva-collab-'));
const server = createServer(0, '127.0.0.1', directory);
beforeAll(async () => { await server.listen(); });
afterAll(async () => { await server.destroy(); rmSync(directory, { recursive: true, force: true }); });
it('STEP1-COLLAB: boots Hocuspocus and responds to a real HTTP request', async () => {
  const response = await fetch(`${server.httpURL}/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ service: 'collaboration', status: 'ok', implementationStep: 4 });
});
