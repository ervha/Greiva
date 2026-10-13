import { it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { CompactEncrypt } from 'jose';
import { mkdtemp, mkdir, writeFile, readFile, stat, readdir, symlink, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { encryptPrivateBackup, decryptPrivateBackup, maxPrivateBackupBytes } from '../../scripts/private-backup.js';

const archive = () => Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(16), Buffer.from('synthetic fixture only: 日本語 body; pending operation')]);
const key = () => randomBytes(32);
it('BACKUP: standard authenticated JWE round-trip, fresh nonce, no plaintext in envelope and caller buffers preserved', async () => {
  const data = archive(), secret = key(), before = Buffer.from(secret), a = await encryptPrivateBackup(data, secret), b = await encryptPrivateBackup(data, secret);
  expect(a).not.toBe(b); expect(a.split('.')[2]).not.toBe(b.split('.')[2]); expect(a).not.toContain('synthetic');
  expect(Buffer.from(await decryptPrivateBackup(a, secret))).toEqual(data); expect(secret).toEqual(before);
});
it('BACKUP: wrong key, every envelope part modified, truncation and appended data refuse with fixed errors', async () => {
  const secret = key(), encrypted = await encryptPrivateBackup(archive(), secret);
  await expect(decryptPrivateBackup(encrypted, key())).rejects.toThrow('Private backup operation failed');
  for (const index of [0, 2, 3, 4]) { const parts = encrypted.split('.'); const bytes = Buffer.from(parts[index]!, 'base64url'); bytes[0] = bytes[0]! ^ 1; parts[index] = bytes.toString('base64url'); await expect(decryptPrivateBackup(parts.join('.'), secret)).rejects.toThrow('Private backup operation failed'); }
  for (const damaged of [encrypted.slice(0, -10), encrypted + '.extra', 'private content\n' + encrypted]) await expect(decryptPrivateBackup(damaged, secret)).rejects.toThrow('Private backup operation failed');
});
it('BACKUP: rejects unsupported type/headers/algorithm and authenticated non-archive payload', async () => {
  const secret = key();
  for (const header of [{ alg:'dir',enc:'A256GCM',typ:'other' },{ alg:'dir',enc:'A256GCM',typ:'greiva-pg-backup-v1+jwe',extra:'secret' },{ alg:'dir',enc:'A128CBC-HS256',typ:'greiva-pg-backup-v1+jwe' }]) {
    const encoded = await new CompactEncrypt(archive()).setProtectedHeader(header).encrypt(secret);
    await expect(decryptPrivateBackup(encoded, secret)).rejects.toThrow('Private backup operation failed');
  }
  const encoded = await new CompactEncrypt(Buffer.from('not a pg_dump archive')).setProtectedHeader({alg:'dir',enc:'A256GCM',typ:'greiva-pg-backup-v1+jwe'}).encrypt(secret);
  await expect(decryptPrivateBackup(encoded,secret)).rejects.toThrow('Private backup operation failed');
});
it('BACKUP: bad key, missing magic and bounded archive fail before producing an envelope', async () => {
  for (const secret of [randomBytes(16), randomBytes(33)]) await expect(encryptPrivateBackup(archive(),secret)).rejects.toThrow();
  await expect(encryptPrivateBackup(Buffer.from('secret input'),key())).rejects.toThrow('Private backup operation failed');
  await expect(encryptPrivateBackup(Buffer.alloc(maxPrivateBackupBytes+1),key())).rejects.toThrow('Private backup operation failed');
});

it('BACKUP-CLI: private files, no overwrite, no output on wrong key/tampering, strict paths and safe diagnostics', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'greiva-backup-test-'));
  try {
    for (const dir of ['keys','archives','restore']) await mkdir(path.join(root,dir),{mode:0o700});
    const input=path.join(root,'fixture.dump'), secret=path.join(root,'keys','key'), wrong=path.join(root,'keys','wrong'), encrypted=path.join(root,'archives','backup.jwe'), restored=path.join(root,'restore','restored.dump');
    await writeFile(input,archive(),{mode:0o600});await writeFile(secret,key(),{mode:0o600});await writeFile(wrong,key(),{mode:0o600});
    const run=(mode:string,source:string,dest:string,k=secret)=>spawnSync(process.execPath,['scripts/private-backup.mjs',mode,source,dest,k],{encoding:'utf8'});
    const encryptedResult=run('encrypt',input,encrypted);expect(encryptedResult.status,encryptedResult.stderr).toBe(0);expect((await stat(encrypted)).mode&0o777).toBe(0o600);
    const saved=await readFile(encrypted);expect(run('encrypt',input,encrypted).status).toBe(1);expect(await readFile(encrypted)).toEqual(saved);
    const failed=run('decrypt',encrypted,restored,wrong);expect(failed.status).toBe(1);expect(failed.stdout).toBe('');expect(failed.stderr.trim()).toBe('{"service":"private-backup","event":"failed"}');expect(await readdir(path.dirname(restored))).toEqual([]);
    expect(run('decrypt',encrypted,restored).status).toBe(0);expect(await readFile(restored)).toEqual(archive());
    const tampered=path.join(root,'damaged.jwe'), parts=saved.toString().split('.');const ciphertext=Buffer.from(parts[3]!,'base64url');ciphertext[0]=ciphertext[0]!^1;parts[3]=ciphertext.toString('base64url');await writeFile(tampered,parts.join('.'));
    expect(run('decrypt',tampered,path.join(root,'restore','bad.dump')).status).toBe(1);expect(await readdir(path.join(root,'restore'))).toEqual(['restored.dump']);
    const link=path.join(root,'input-link');await symlink(input,link);expect(run('encrypt',link,path.join(root,'archives','linked.jwe')).status).toBe(1);
    const targetLink=path.join(root,'archives','target-link');await symlink(input,targetLink);expect(run('encrypt',input,targetLink).status).toBe(1);expect(await readFile(input)).toEqual(archive());
    expect(run('encrypt',input,path.join(root,'keys','same-key-folder.jwe')).status).toBe(1);
    await mkdir(path.join(root,'public'),{mode:0o755});expect(run('encrypt',input,path.join(root,'public','exposed.jwe')).status).toBe(1);
    const keyLink=path.join(root,'keys','link');await symlink(secret,keyLink);expect(run('encrypt',input,path.join(root,'archives','key-link.jwe'),keyLink).status).toBe(1);
    await chmod(secret,0o644);expect(run('encrypt',input,path.join(root,'archives','public-key.jwe')).status).toBe(1);
    expect((await readdir(path.join(root,'archives'))).sort()).toEqual(['backup.jwe','target-link']);
  } finally { await rm(root,{recursive:true,force:true}); }
},30000);
