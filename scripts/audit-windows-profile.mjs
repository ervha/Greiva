import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as Y from 'yjs';

const directory=path.resolve(process.argv[2]);
const read=name=>{const file=path.join(directory,name);return fs.existsSync(file)?fs.readFileSync(file):gunzipSync(fs.readFileSync(file+'.gz'));};
const load=name=>JSON.parse(read(name));
const seed=load('seed-tables.json'),after=load('after-input-tables.json'),reopened=load('reopened-tables.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const table of Object.keys(seed))if(!['pages','page_updates','sqlite_sequence'].includes(table))assert.deepEqual(after[table],seed[table],table);
assert.deepEqual(reopened,after,'Every stored table must survive the no-edit restart');
assert.equal(seed.page_updates.length,1001);assert.equal(after.page_updates.length,1005);
assert.deepEqual(after.page_updates.slice(0,1001),seed.page_updates,'Original journal must remain byte-exact');
assert.equal(after.tasks.length,250);assert.equal(after.sync_operations.length,250);assert(after.sync_operations.every(operation=>operation.status==='pending'));
function reconstruct(tables){
 const doc=new Y.Doc();for(const row of tables.page_updates){const update=Uint8Array.from(Object.values(row.update_bytes));assert.equal(sha(update),Buffer.from(Object.values(row.digest)).toString('hex'));Y.applyUpdate(doc,update);}
 const body=doc.getXmlFragment('body'),rows=body.toArray().map(node=>node.toArray().map(leaf=>leaf.toString()).join(''));
 const result={rows,xmlSha256:sha(body.toString()),clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b)};doc.destroy();return result;
}
const before=reconstruct(seed),final=reconstruct(after);assert.equal(final.rows.length,1000);assert.deepEqual(final.rows.slice(1),before.rows.slice(1));
const pasted='abcdefghijklmnopqrstuvwxyz'.repeat(4);assert.equal(final.rows[0],before.rows[0]+pasted+'abc');
const reports=read('reopened-reports.jsonl').toString().trim().split('\n').map(JSON.parse);
const runs=new Map();for(const report of reports)runs.set(report.frontend.timeOrigin,report);
assert.equal(runs.size,4);const timings=[];
for(const report of runs.values()){
 const f=report.frontend,mark=id=>{const value=f.records.find(record=>record.id===id);assert(value,id);return value;},span=id=>{const value=report.nativeSpans.find(record=>record.id===id);assert(value,id);return value;};
 assert.equal(f.dom.paragraphs,1000);assert.equal(f.dom.handles,1000);assert.equal(f.dom.editable,'true');assert.equal(f.dom.save,'端末に保存済み');
 const restore=mark('yjs-restore');assert.equal(restore.blocks,1000);assert.equal(mark('tasks-two-raf').tasks,250);
 timings.push({timeOrigin:f.timeOrigin,pageUpdates:restore.updates,sqliteOpen:span('page_list-store-open').duration,pageQuery:span('page_load-query').duration,pageIpc:f.records.find(record=>record.id==='ipc'&&record.command==='page_load').duration,yjs:restore,editorRenderToEffect:mark('editor-effect').at-mark('editor-render').at,editorRenderToTwoRaf:mark('editor-two-raf').at-mark('editor-render').at,navigationToEditorTwoRaf:mark('editor-two-raf').at,navigationToTasksTwoRaf:mark('tasks-two-raf').at,taskQuery:span('structured_snapshot-query').duration,longTasks:f.longTasks});
}
assert.deepEqual(timings.map(run=>run.pageUpdates),[1001,1001,1001,1005]);
const input=[...runs.values()].find(report=>report.frontend.records.some(record=>record.id==='keydown'&&record.key==='a'));assert(input);
const records=input.frontend.records,keys=records.filter(record=>record.id==='keydown'&&['a','b','c'].includes(record.key));
assert.deepEqual(keys.map(key=>key.key),['a','b','c']);assert(keys.every(key=>key.trusted&&!key.composing));
assert.equal(records.filter(record=>record.id==='input').length,3);assert(!records.some(record=>record.id==='compositionstart'));
const keyTimings=keys.map((key,index)=>{
 const next=keys[index+1]?.start??Infinity;
 const frame=records.find(record=>record.id==='keydown-two-raf'&&record.start===key.start),event=records.find(record=>record.id==='input'&&record.start>=key.start&&record.start<next),append=records.find(record=>record.id==='ipc'&&record.command==='page_append'&&record.start>=key.start&&record.start<next);
 assert(frame&&event&&append);assert(event.trusted&&!event.composing&&event.inputType==='insertText'&&event.dataLength===1);
 return {key:key.key,trusted:true,keydownToTwoRaf:frame.duration,appendIpc:append.duration,keydownToAppendResolved:append.at-key.start,inputToAppendResolved:append.at-event.start};
});
const pasteKey=records.find(record=>record.id==='keydown'&&record.key==='v'),pasteAppend=records.find(record=>record.id==='ipc'&&record.command==='page_append'&&record.start>=pasteKey?.start&&record.start<keys[0].start);assert(pasteKey&&pasteAppend);
const result={result:'Pass',product:'0.6.25 diagnostic',runs:timings,paste:{characters:104,observedShortcut:'Control+v',inputEvents:0,appendIpc:pasteAppend.duration,shortcutToAppendResolved:pasteAppend.at-pasteKey.start},keyTimings,database:{beforeUpdates:1001,afterUpdates:1005,blocks:1000,other999ParagraphsUnchanged:true,originalUpdatesByteExact:true,structuredTablesUnchanged:true,allTablesUnchangedAfterRestart:true,allDigestsVerified:true,pending:250,xmlSha256:final.xmlSha256,clocks:final.clocks},scope:'Windows instrumented Tauri/WebView2, four starts, one clipboard paste and three spaced actual ASCII keys. Internal clocks/rAF are not OS-to-presentation latency, continuous input, IME or normal executable SLO evidence.'};
const output=process.argv[3];if(output)fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({result:'Pass',runs:4,pasteCharacters:104,actualKeys:3,updates:1005,other999Unchanged:true}));
