// Run in Docker against selected raw evidence. No Android input or synthetic events.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const base=process.argv[2]??'/tmp/android-selected';
const read=path=>JSON.parse(readFileSync(`${base}/${path}`,'utf8'));
const automatic=read('auto/results.json'),ime=read('ime/results.json'),sync=read('sync/results.json');
assert.equal(automatic.outcome,'Pass');assert.equal(automatic.records.length,26);
assert.ok(automatic.records.every(r=>r.result==='Pass'&&r.peerMatches&&r.state.testHooks==='undefined'));
assert.equal(ime.remote.length,3);assert.deepEqual(ime.remote.map(r=>r.index),[1,2,3]);
assert.ok(ime.remote.every(r=>r.trigger.type==='compositionstart'&&r.trigger.isTrusted&&r.trigger.block===1));
assert.equal(ime.final.bodyXml,'<paragraph>ANDROID611 local 日本語</paragraph><paragraph>［遠隔3］［遠隔2］［遠隔1］ANDROID611 remote 日本語</paragraph><paragraph>ANDROID611 peer</paragraph>');
assert.equal(ime.final.bodyXml,ime.peer.bodyXml);assert.deepEqual(ime.final.clocks,ime.peer.clocks);
const events=ime.final.events;const compositions=[0,1].map(block=>{
 const start=events.find(e=>e.block===block&&e.type==='compositionstart'&&e.isTrusted);
 const converted=events.find(e=>e.block===block&&e.type==='input'&&e.isTrusted&&e.data==='日本語');
 assert.ok(start&&converted);assert.ok(events.some(e=>e.block===block&&e.type==='compositionupdate'&&e.isTrusted&&e.data==='にほんご'));
 return {block,startPerformanceAt:start.performanceAt,convertedPerformanceAt:converted.performanceAt,elapsedMs:converted.performanceAt-start.performanceAt};
});
assert.ok(compositions[1].elapsedMs>=3000);
assert.ok(events.some(e=>e.block===1&&e.isTrusted&&e.isComposing&&e.performanceAt<compositions[1].convertedPerformanceAt&&e.text.includes('［遠隔3］［遠隔2］［遠隔1］')));
assert.equal(sync.outcome,'Pass');assert.equal(sync.records.length,4);assert.ok(sync.records.every(r=>r.result==='Pass'));
assert.equal(sync.preservedIME.bodyXml,ime.final.bodyXml);assert.deepEqual(sync.preservedIME.clocks,ime.final.clocks);
assert.equal(sync.final.bodyXml,sync.peer.bodyXml);assert.deepEqual(sync.final.clocks,sync.peer.clocks);
const eventTrust=Object.fromEntries([...new Set(events.map(e=>`${e.type}:${e.isTrusted}`))].map(k=>[k,events.filter(e=>`${e.type}:${e.isTrusted}`===k).length]));
const verification={at:new Date().toISOString(),result:'Pass',automaticCases:26,reconnectCases:4,compositions,eventTrust,remoteUpdates:3,imeTextAndClocksMatch:true,syncTextAndClocksMatch:true,imeFixtureUnchangedBeforeNextTest:true,scope:'Trusted Gboard start/update/beforeinput/input observed; compositionend events have isTrusted=false and are preserved as such, not presented as trusted OS events. Controller did not dispatch composition events. Phone and controller wall clocks differ; duration uses phone performance timestamps only. Candidate appearance is user-reported, not independently recorded.'};
writeFileSync(`${base}/verification.json`,JSON.stringify(verification,null,2)+'\n');console.log(JSON.stringify(verification));
