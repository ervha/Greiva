import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { encryptPrivateBackup, decryptPrivateBackup, maxPrivateBackupBytes, maxPrivateBackupEnvelopeBytes } from './private-backup.ts';

// Operator-only Docker CLI. Fixed status output; never print paths, SQL or keys.
async function boundedRead(file, limit, exact) {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > limit || before.size === 0 || (exact !== undefined && (before.size !== exact || (before.mode & 0o077) !== 0))) throw Error();
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) { const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset); if (!bytesRead) throw Error(); offset += bytesRead; }
    if ((await handle.read(Buffer.alloc(1), 0, 1, offset)).bytesRead) throw Error();
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw Error();
    return bytes;
  } finally { await handle.close(); }
}

let key, plaintext, temporary, temporaryCreated = false;
try {
  await fs.access('/.dockerenv');
  const [mode, input, output, keyFile, ...extra] = process.argv.slice(2);
  if (!['encrypt', 'decrypt'].includes(mode) || !input || !output || !keyFile || extra.length) throw Error();
  const target = path.resolve(output), parent = await fs.realpath(path.dirname(target));
  if (parent !== path.dirname(target) || ((await fs.stat(parent)).mode & 0o077) !== 0) throw Error();
  const realKey = await fs.realpath(keyFile), realInput = await fs.realpath(input);
  if (realKey === realInput || realKey === parent || realKey.startsWith(parent + path.sep) || realInput === target) throw Error();
  try { await fs.lstat(target); throw Error('exists'); } catch (error) { if (error.code !== 'ENOENT') throw Error(); }
  key = await boundedRead(keyFile, 32, 32);
  let result;
  if (mode === 'encrypt') {
    plaintext = await boundedRead(input, maxPrivateBackupBytes);
    result = Buffer.from(await encryptPrivateBackup(plaintext, key), 'ascii');
  } else {
    const encoded = await boundedRead(input, maxPrivateBackupEnvelopeBytes);
    if (encoded.some(byte => byte > 127)) throw Error();
    plaintext = await decryptPrivateBackup(encoded.toString('ascii'), key);
    result = plaintext;
  }
  temporary = path.join(parent, '.greiva-backup-' + randomUUID() + '.tmp');
  const file = await fs.open(temporary, 'wx', 0o600);
  temporaryCreated = true;
  try { await file.writeFile(result); await file.sync(); } finally { await file.close(); }
  // Atomic no-clobber publication. An existing file/symlink is never replaced.
  await fs.link(temporary, target);
  await fs.unlink(temporary); temporary = undefined;
  const directory = await fs.open(parent, 'r');
  try { await directory.sync(); } finally { await directory.close(); }
  console.log(JSON.stringify({ service: 'private-backup', event: mode === 'encrypt' ? 'encrypted' : 'decrypted', format: 1, bytes: result.byteLength }));
} catch {
  console.error(JSON.stringify({ service: 'private-backup', event: 'failed' }));
  process.exitCode = 1;
} finally {
  key?.fill(0); plaintext?.fill(0);
  if (temporary && temporaryCreated) { try { await fs.unlink(temporary); } catch { /* leave only a private temporary on cleanup failure */ } }
}
