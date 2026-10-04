import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const files=['CHANGELOG.md','docs/plan/DEVELOPMENT_STATUS.md','docs/plan/DEFERRED_VALIDATION.md','docs/plan/POC_VALIDATION_MATRIX.md','docs/plan/GATE_REVIEW_DRAFT.md','tests/evidence/README.md','docs/decisions/gate-a.md','docs/decisions/gate-b.md','docs/decisions/gate-c.md','docs/decisions/poc-technology-selection.md','docs/decisions/poc-autonomous-review.md','tests/evidence/poc-gate-review-20261004/SUMMARY.md'];
let checked=0;
const inventory=new Set(fs.readFileSync('tests/evidence/poc-gate-review-20261004/inventory.txt','utf8').split(/\r?\n/).filter(Boolean).map(file=>path.resolve(file.replaceAll('\\','/'))));
for(const file of files){
 const content=fs.readFileSync(file,'utf8');
 assert(!content.includes('\uFFFD'),file+' invalid encoding');
 for(const [,target] of content.matchAll(/\]\(([^)]+)\)/g)){
  if(/^(https?:|#)/.test(target))continue;
  const resolved=path.resolve(path.dirname(file),target.split('#')[0]);
  assert(inventory.has(resolved)||[...inventory].some(entry=>entry.startsWith(resolved+path.sep)),file+' missing link '+target);checked++;
 }
}
const audit=JSON.parse(fs.readFileSync('tests/evidence/poc-gate-review-20261004/continuous-audit.json'));
assert.equal(audit.finalUpdates,76);assert.equal(audit.baselineUpdates,30);assert.equal(audit.blocks,1000);assert.equal(audit.additionalTextUtf16Length,24);
for(const key of ['baseline30UpdateBytesRetained','originalFirstParagraphPrefixRetained','other999ParagraphsUnchanged','peerXmlAndClocksEqual'])assert.equal(audit[key],true);
assert.equal(audit.product,'0.6.20');assert.equal(fs.readFileSync('VERSION','utf8').trim(),'0.6.23');
const gateA=fs.readFileSync('docs/decisions/gate-a.md','utf8'),gateB=fs.readFileSync('docs/decisions/gate-b.md','utf8'),gateC=fs.readFileSync('docs/decisions/gate-c.md','utf8');
assert(gateA.startsWith('# Gate A: Editor viability — Pass'));assert(gateB.startsWith('# Gate B: Offline and convergence viability — Conditional'));assert(gateC.startsWith('# Gate C: Structured sync viability — Pass'));
const result={result:'Pass',files:files.length,localLinks:checked,audit:'30→76 updates / 1000 paragraphs / 24 UTF-16 units',scope:'Documentation/evidence review only; no new application regression run'};
fs.writeFileSync('tests/evidence/poc-gate-review-20261004/document-review.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
