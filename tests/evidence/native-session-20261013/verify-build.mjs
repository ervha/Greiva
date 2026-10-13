// Docker read-only audit. Input is a host source inventory, not credentials.
import fs from 'node:fs';
import crypto from 'node:crypto';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const expected = JSON.parse(fs.readFileSync('/tmp/autonomous-host-source.json', 'utf8'));
const rows = expected.filter(row => row.path.startsWith('apps/client/src-tauri/') || row.path === 'VERSION' || /(^|\/)(package(-lock)?\.json)$/.test(row.path));
const compared = rows.map(row => {
  const bytes = fs.readFileSync(row.path);
  const normalized = row.bom ? bytes : Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
  const match = sha(bytes) === row.sha256 ? 'raw' : sha(normalized) === row.textSha256 ? 'LF-text' : 'mismatch';
  return { path:row.path, match };
});
if (compared.some(row => row.match === 'mismatch')) throw new Error('Host/native build source mismatch');
const bytes = fs.readFileSync('.data/windows-target/x86_64-pc-windows-msvc/debug/greiva-poc.exe');
const pe = bytes.readUInt32LE(0x3c);
if (bytes.toString('ascii',0,2)!=='MZ' || bytes.readUInt32LE(pe)!==0x4550 || bytes.readUInt16LE(pe+4)!==0x8664) throw new Error('Invalid Windows x64 PE');
console.log(JSON.stringify({version:fs.readFileSync('VERSION','utf8').trim(),sha256:sha(bytes),bytes:bytes.length,peMachine:'x86_64',builtInDocker:true,hostLaunched:false,nativeImeTested:false,features:['custom-protocol'],crashHooks:false,sourceComparison:compared},null,2));
