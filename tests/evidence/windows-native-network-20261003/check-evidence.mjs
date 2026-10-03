// Run in Docker against an explicit checkout inventory; no product tests.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,posix} from 'node:path';
const base='tests/evidence/windows-native-network-20261003/';
const json=name=>JSON.parse(readFileSync(base+name,'utf8'));
const report=json('verification.json');
assert.equal(report.version,'0.6.11');assert.equal(report.unchangedBodiesAndClocks,true);assert.equal(report.rustRepositoryAgrees,true);
assert.equal(report.crash.received.length,1);assert.equal(report.final.received.length,2);assert.equal(report.ledger.length,2);assert.equal(report.native.state.cursor,report.peer.state.cursor);
assert.equal(json('original-and-crash-copy-hashes.json').originalFixtureUnchanged,true);
for(const file of json('original-and-crash-copy-hashes.json').originalFiles)assert.equal(file.initialSha256,file.currentSha256);
const copy=json('final-copy-hashes.json');assert.equal(copy.processAbsent,true);for(const file of copy.files)assert.equal(file.sourceSha256,file.copySha256);
assert.equal(json('source-verification.json').count,135);for(const file of json('source-verification.json').checks)assert.equal(file.sha256,file.containerSha256);
const offline=json('offline-ui-observation.json')[0];assert.match(offline.accessibility.document_text,/送信待ち 1件/);assert.match(offline.accessibility.document_text,/オフライン/);
assert.match(json('final-native-ui.json').documentText,/送信待ち 0件/);assert.match(json('final-native-ui.json').documentText,/サーバーと同期済み/);assert.match(json('final-native-ui.json').documentText,/端末に保存済み/);
for(const file of ['before-ack-crash.jpg','offline-restored.jpg','final-native.jpg'])assert.equal(readFileSync(base+file).subarray(0,2).toString('hex'),'ffd8');
const files=JSON.parse(readFileSync('/tmp/native-network-checkout-files.json','utf8'));let links=0;
for(const file of ['CHANGELOG.md','docs/plan/DEVELOPMENT_STATUS.md','docs/plan/POC_VALIDATION_MATRIX.md','docs/plan/DEFERRED_VALIDATION.md','tests/evidence/README.md',base+'SUMMARY.md']){
 for(const match of readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){const link=match[1];if(/^(?:https?:|#)/.test(link))continue;const target=posix.normalize(posix.join(dirname(file),link.split('#')[0]));assert.ok(files.includes(target)||files.some(p=>p.startsWith(target.replace(/\/$/,'')+'/')),`${file}: ${target}`);links++;}
}
assert.equal(readFileSync('VERSION','utf8').trim(),'0.6.13');assert.equal(JSON.parse(readFileSync('package.json','utf8')).version,'0.6.11');
writeFileSync('/tmp/native-network-evidence-check.json',JSON.stringify({at:new Date().toISOString(),execution:'Docker',result:'Pass',linksChecked:links,evidenceConsistent:true,scope:'Selected native evidence and document audit; no new product suite or Gate verdict.'},null,2)+'\n');
console.log(JSON.stringify({result:'Pass',linksChecked:links,evidenceConsistent:true}));
