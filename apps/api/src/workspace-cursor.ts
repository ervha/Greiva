import { createHmac, timingSafeEqual } from 'node:crypto';
import { idSchema } from '@greiva/shared';
import { structuredOrderSchema } from '@greiva/protocol/workspace';

export class InvalidWorkspaceCursor extends Error {
  constructor() { super('Invalid workspace cursor'); this.name = 'InvalidWorkspaceCursor'; }
}
// Server-only cursor integrity, not user authentication. Key/epoch must be
// durably configured before live use. Do not generate a new key on each start.
export function workspaceCursor(workspaceId: string, streamEpoch: string, secret: Uint8Array) {
  const workspace = idSchema.parse(workspaceId), epoch = idSchema.parse(streamEpoch);
  if (secret.byteLength < 32) throw new Error('Workspace cursor key must contain at least 32 bytes');
  const key = Buffer.from(secret);
  const sign = (content: string) => createHmac('sha256', key).update(`gw1.${content}`).digest();
  return Object.freeze({
    encode(order: string) {
      const sequence = structuredOrderSchema.parse(order);
      const content = Buffer.from(JSON.stringify([workspace, 'structured', epoch, sequence])).toString('base64url');
      return `gw1.${content}.${sign(content).toString('base64url')}`;
    },
    decode(candidate: unknown, headOrder: string): bigint {
      const head = BigInt(structuredOrderSchema.parse(headOrder));
      if (candidate === null) return 0n;
      try {
        if (typeof candidate !== 'string' || candidate.length > 1024) throw new InvalidWorkspaceCursor();
        const parts = candidate.split('.');
        if (parts.length !== 3 || parts[0] !== 'gw1' || !/^[A-Za-z0-9_-]+$/.test(parts[1]!) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2]!)) throw new InvalidWorkspaceCursor();
        const content = Buffer.from(parts[1]!, 'base64url'), signature = Buffer.from(parts[2]!, 'base64url');
        if (content.toString('base64url') !== parts[1] || signature.toString('base64url') !== parts[2]
          || signature.length !== 32 || !timingSafeEqual(signature, sign(parts[1]!))) throw new InvalidWorkspaceCursor();
        const value: unknown = JSON.parse(content.toString('utf8'));
        if (!Array.isArray(value) || value.length !== 4 || value[0] !== workspace || value[1] !== 'structured' || value[2] !== epoch) throw new InvalidWorkspaceCursor();
        const sequence = BigInt(structuredOrderSchema.parse(value[3]));
        if (sequence > head) throw new InvalidWorkspaceCursor();
        return sequence;
      } catch { throw new InvalidWorkspaceCursor(); }
    },
  });
}
