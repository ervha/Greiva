import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, ftruncateSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import * as Y from 'yjs';

// Single-process PoC journal: length + SHA-256 + raw Yjs update. Never JSON projections.
// Synchronous append/fsync serializes all received updates before Hocuspocus applies/ACKs them.
export class UpdateStore {
  private failed = new Set<string>();
  constructor(readonly directory: string) { mkdirSync(directory, { recursive: true }); }
  path(name: string) {
    if (!/^page:[a-zA-Z0-9-]{1,80}$/.test(name)) throw new Error('Invalid Page document name');
    return join(this.directory, `${name.slice(5)}.updates`);
  }
  append(name: string, update: Uint8Array) {
    Y.decodeUpdate(update); // Reject malformed updates before adding them to the journal.
    const file = this.path(name);
    if (this.failed.has(name)) throw new Error(`Yjs journal requires recovery: ${name}`);
    const created = !existsSync(file);
    const header = Buffer.alloc(40);
    header.writeUInt32BE(update.length);
    header.writeUInt32BE((~update.length) >>> 0, 4);
    createHash('sha256').update(update).digest().copy(header, 8);
    const record = Buffer.concat([header, update]);
    const fd = openSync(file, 'a', 0o600);
    try {
      let offset = 0;
      while (offset < record.length) offset += writeSync(fd, record, offset);
      fsyncSync(fd);
    } catch (error) { this.failed.add(name); throw error; }
    finally { closeSync(fd); }
    if (created) {
      const dir = openSync(this.directory, 'r');
      try { fsyncSync(dir); } catch (error) { this.failed.add(name); throw error; }
      finally { closeSync(dir); }
    }
  }
  restore(name: string, document: Y.Doc) {
    const file = this.path(name);
    if (!existsSync(file)) return false;
    const bytes = readFileSync(file);
    let offset = 0;
    while (offset + 40 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      if (((~length) >>> 0) !== bytes.readUInt32BE(offset + 4)) throw new Error(`Corrupt Yjs journal header: ${name} at ${offset}`);
      if (offset + 40 + length > bytes.length) break;
      const update = bytes.subarray(offset + 40, offset + 40 + length);
      if (!createHash('sha256').update(update).digest().equals(bytes.subarray(offset + 8, offset + 40))) {
        throw new Error(`Corrupt Yjs journal: ${name} at ${offset}`);
      }
      Y.applyUpdate(document, update);
      offset += 40 + length;
    }
    // Only a partial final record can be discarded: it was never fsynced/ACKed.
    // Complete but corrupt records fail closed; do not silently reset a document.
    if (offset !== bytes.length) {
      const fd = openSync(file, 'r+');
      try { ftruncateSync(fd, offset); fsyncSync(fd); } finally { closeSync(fd); }
    }
    return offset > 0;
  }
}
