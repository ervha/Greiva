import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
const [passiveLog,keyLog,passiveDb,keyDb,output,focusLog,focusDb]=process.argv.slice(2);
const parse=file=>readFileSync(file,'utf8').split(/\r?\n/).filter(s=>s.startsWith('GREIVA_IME_TRACE ')).map(s=>JSON.parse(s.slice(17)));
const passive=parse(passiveLog),key=parse(keyLog);
const passiveId='01a0f83f-ffbe-76e3-8741-4bbb21f245b0',keyId='01a0f857-7278-7400-89d3-9258178574c0';
const sequence=(all,pageId)=>all.filter(r=>r.pageId===pageId).sort((a,b)=>a.seq-b.seq);
const p=sequence(passive,passiveId),k=sequence(key,keyId);
const events=(all,from,to)=>all.filter(r=>r.seq>=from&&r.seq<=to);
const compact=r=>({seq:r.seq,at:r.at,surface:r.surface,type:r.type,key:r.key,code:r.code,trusted:r.trusted,inputType:r.inputType,data:r.data,domText:r.domText,domSelection:r.domSelection,textarea:r.textarea,pm:r.pm,targetRanges:r.targetRanges,steps:r.steps});
const cases=[];
function failure(id,all,from,to,surface,deleteSeq,hasConvert){
 const selected=events(all,from,to).filter(r=>r.surface===surface),deletion=selected.find(r=>r.seq===deleteSeq);
 assert.equal(deletion.type,'beforeinput');assert.equal(deletion.inputType,'deleteContentBackward');assert.equal(deletion.trusted,true);
 const selection=deletion.domSelection;
 if(surface==='textarea'){assert.equal(deletion.textarea.start,8);assert.equal(deletion.textarea.end,14);assert.equal(deletion.textarea.value.slice(8,14),'al 日本語');}
 else{assert.equal(selection.selected,'al 日本語');assert.equal(deletion.targetRanges[0].start.offset,8);assert.equal(deletion.targetRanges[0].end.offset,14);}
 assert(selected.some(r=>r.type==='blur'&&(surface==='textarea'?r.textarea.start===11&&r.textarea.end===14:r.domSelection.selected==='日本語')));
 assert(selected.some(r=>r.type==='focus'&&(surface==='textarea'?r.textarea.start===11&&r.textarea.end===14:r.domSelection.selected==='日本語')));
 assert.equal(selected.some(r=>r.type==='keydown'&&r.code==='Convert'),hasConvert);
 const start=selected.find(r=>r.type==='compositionstart');assert(start.seq>deletion.seq);assert.equal(start.data,'');
 const last=selected.filter(r=>r.type==='compositionend'||r.type==='input').at(-1);
 const text=last.textarea?.value??last.pm?.text??last.domText;
 assert.equal(text.replace(/^⠿/,''),'MS65 loc日本語');
 cases.push({id,surface,result:'Fail: prefix lost',window:[from,to],capturedConvertKeydown:hasConvert,deletionSeq:deleteSeq,compositionStartSeq:start.seq,events:selected.map(compact)});
}
failure('passive-greiva-focus-after-selection',p,145,186,'greiva',150,true);
failure('passive-textarea-focus-after-selection',p,274,281,'textarea',276,false);
failure('passive-plain-dom-focus-after-selection',p,462,476,'plain-dom',465,true);
failure('convert-key-guard-not-reached',k,132,153,'greiva',136,false);
for(const [id,from,to] of [['plain-dom-no-switch-after-selection-1',393,418],['plain-dom-no-switch-after-selection-2',422,448]]){
 const selected=events(p,from,to).filter(r=>r.surface==='plain-dom');
 assert(!selected.some(r=>r.type==='blur'||r.type==='focus'||r.inputType==='deleteContentBackward'));
 assert(selected.some(r=>r.type==='keydown'&&r.code==='Convert'&&r.domSelection.selected==='日本語'));
 assert.equal(selected.find(r=>r.type==='compositionstart').data,'日本語');
 assert.equal(selected.filter(r=>r.type==='compositionend').at(-1).domText,'MS65 local 日本語');
 cases.push({id,surface:'plain-dom',result:'Preserved text in this manual diagnostic case',window:[from,to],events:selected.map(compact)});
}
assert(k.some(r=>r.type==='probe-switch'&&r.enabled===true));
assert(!events(k,132,153).some(r=>r.type==='probe-selection-direction'));
function audit(path,pageId){
 const loaded=spawnSync('.data/native-target/debug/examples/store-driver',[path],{input:JSON.stringify({id:'ime-focus-audit',command:'load',pageId})+'\n',encoding:'utf8',maxBuffer:64*1024*1024});
 assert.equal(loaded.status,0,loaded.stderr);const reply=JSON.parse(loaded.stdout.trim());assert(!reply.error,JSON.stringify(reply));
 const doc=new Y.Doc(),journal=[];for(const [index,bytes] of reply.value.updates.entries()){
  const before=doc.getXmlFragment('body').toString();Y.applyUpdate(doc,Uint8Array.from(bytes),'copied-journal');const after=doc.getXmlFragment('body').toString();
  journal.push({update:index+1,bytes:bytes.length,before,after});
 }
 const xml=doc.getXmlFragment('body').toString();doc.destroy();return {pageId,databaseCopy:path,journalUpdates:journal.length,journalBytes:journal.reduce((sum,r)=>sum+r.bytes,0),xml,expected:'<paragraph>MS65 local 日本語</paragraph>',matchesExpected:xml==='<paragraph>MS65 local 日本語</paragraph>',journal};
}
const stores=[audit(passiveDb,passiveId),audit(keyDb,keyId)];
assert.equal(stores[0].matchesExpected,false);assert(stores[0].journal.some(r=>r.before==='<paragraph>MS65 local 日本語</paragraph>'&&r.after==='<paragraph>MS65 loc</paragraph>'));
// The operator continued after reporting the key-guard failure. Final repaired text must not erase the earlier failure.
assert(stores[1].journal.some(r=>r.before==='<paragraph>MS65 local 日本語</paragraph>'&&r.after==='<paragraph>MS65 loc</paragraph>'));
if(focusLog&&focusDb){
 const focusId='01a0f863-d510-7081-aaf4-3f91be2b73d5',f=sequence(parse(focusLog),focusId);
 failure('focus-guard-reached-but-loss-remains',f,160,187,'greiva',168,true);
 const normalized=f.find(r=>r.seq===163);assert.equal(normalized.type,'probe-selection-direction');
 assert.equal(normalized.beforeSnapshot.domSelection.selected,'日本語');assert.equal(normalized.domSelection.selected,'日本語');
 assert.equal(normalized.beforeSnapshot.domSelection.anchor.offset,14);assert.equal(normalized.beforeSnapshot.domSelection.focus.offset,11);
 assert.equal(normalized.domSelection.anchor.offset,11);assert.equal(normalized.domSelection.focus.offset,14);
 const noSwitch=events(f,115,143).filter(r=>r.surface==='greiva');
 assert(!noSwitch.some(r=>r.type==='focus'||r.type==='blur'||r.inputType==='deleteContentBackward'));
 assert(noSwitch.some(r=>r.type==='keydown'&&r.code==='Convert'&&r.domSelection.selected==='日本語'));
 assert.equal(noSwitch.find(r=>r.type==='compositionstart').data,'日本語');
 assert.equal(noSwitch.filter(r=>r.type==='compositionend').at(-1).pm.text,'MS65 local 日本語');
 cases.push({id:'greiva-no-switch-after-selection',surface:'greiva',result:'Preserved text in this manual diagnostic case',window:[115,143],events:noSwitch.map(compact)});
 cases.push({id:'focus-guard-observed-direction-refresh',surface:'greiva',result:'Executed with same three selected characters; failed to prevent subsequent deletion',event:normalized});
 const saved=audit(focusDb,focusId);assert.equal(saved.matchesExpected,false);stores.push(saved);
}
const report={at:new Date().toISOString(),cases,stores,scope:'Diagnostic source overrides, native trusted events and actual Rust PageStore/Yjs replay of isolated copies. Plain-input cases were operator exploratory comparisons, not an automated randomized trial. No remote edits were sent; no production fix or OS/WebView2 root-cause attribution. Keydown guard was enabled but not reached in the failing batch. Final key-guard database may include subsequent manual repair.'};
writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({cases:cases.map(({id,result})=>({id,result})),stores:stores.map(({pageId,xml,matchesExpected,journalUpdates})=>({pageId,xml,matchesExpected,journalUpdates}))},null,2));
