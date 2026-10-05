import { createHash } from 'node:crypto';
import * as Y from 'yjs';
import { PrivateTransactionInvalidRequest } from './private-transactions.js';

export class PrivatePageInvalidRequest extends PrivateTransactionInvalidRequest {
  constructor(readonly code: 'invalid_request' | 'invalid_document_update' | 'invalid_state_vector' | 'page_id_reused' | 'unsupported_document_schema' = 'invalid_request') { super(); }
}
export const pageUpdateDigest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function bytes(candidate: string, max: number) {
  const value = Buffer.from(candidate, 'base64url');
  if (!value.length || value.length > max || value.toString('base64url') !== candidate) throw new Error();
  return value;
}
// Capture the public Yjs V1 decoder's reader and require full consumption.
// decodeUpdate alone accepts a valid prefix followed by trailing garbage.
export function privatePageUpdate(candidate: string, max: number) {
  try {
    const update = bytes(candidate,max);
    let reader: ConstructorParameters<typeof Y.UpdateDecoderV1>[0] | undefined;
    class CompleteDecoder extends Y.UpdateDecoderV1 {
      constructor(...args: ConstructorParameters<typeof Y.UpdateDecoderV1>) { super(...args); reader = args[0]; }
    }
    Y.decodeUpdateV2(update, CompleteDecoder);
    if (!reader || reader.pos !== update.length) throw new Error();
    return update;
  } catch { throw new PrivatePageInvalidRequest('invalid_document_update'); }
}
export function privatePageVector(candidate: string) {
  try {
    const vector=bytes(candidate,49152),decoded=Y.decodeStateVector(vector);
    if (!Buffer.from(Y.encodeStateVector(decoded)).equals(vector)) throw new Error();
    return vector;
  } catch { throw new PrivatePageInvalidRequest('invalid_state_vector'); }
}
