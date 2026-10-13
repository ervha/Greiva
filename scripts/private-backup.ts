import { CompactEncrypt, compactDecrypt } from 'jose';

export const maxPrivateBackupBytes = 64 * 1024 * 1024;
export const maxPrivateBackupEnvelopeBytes = Math.ceil(maxPrivateBackupBytes * 4 / 3) + 4096;
const type = 'greiva-pg-backup-v1+jwe';
const magic = Buffer.from('PGDMP');

export class PrivateBackupError extends Error {
  constructor() { super('Private backup operation failed'); this.name = 'PrivateBackupError'; }
}

function validateKey(key: Uint8Array) {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) throw new PrivateBackupError();
}

function validateArchive(archive: Uint8Array) {
  if (!(archive instanceof Uint8Array) || archive.byteLength < 20 || archive.byteLength > maxPrivateBackupBytes
    || !Buffer.from(archive.subarray(0, magic.length)).equals(magic)) throw new PrivateBackupError();
}

// Standard compact JWE. The external 256-bit key is never included in the file.
// No caller-provided algorithm/nonce/compression and no decrypted output until
// authentication succeeds. This is an archive transport, not a SQL validator.
export async function encryptPrivateBackup(archive: Uint8Array, key: Uint8Array): Promise<string> {
  try {
    validateKey(key); validateArchive(archive);
    return await new CompactEncrypt(archive).setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: type }).encrypt(key);
  } catch { throw new PrivateBackupError(); }
}

export async function decryptPrivateBackup(envelope: string, key: Uint8Array): Promise<Uint8Array> {
  try {
    validateKey(key);
    if (typeof envelope !== 'string' || envelope.length > maxPrivateBackupEnvelopeBytes
      || !/^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(envelope)) throw new PrivateBackupError();
    const result = await compactDecrypt(envelope, key, { keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'] });
    if (result.protectedHeader.typ !== type || Object.keys(result.protectedHeader).sort().join(',') !== 'alg,enc,typ') throw new PrivateBackupError();
    validateArchive(result.plaintext);
    return result.plaintext;
  } catch { throw new PrivateBackupError(); }
}
