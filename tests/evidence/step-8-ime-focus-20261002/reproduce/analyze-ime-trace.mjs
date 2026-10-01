import {readFileSync,writeFileSync} from 'node:fs';
const [logPath,outputPath]=process.argv.slice(2);
const lines=readFileSync(logPath,'utf8').split(/\r?\n/),records=[],errors=[];
for(const [index,line] of lines.entries()){
 if(!line.startsWith('GREIVA_IME_TRACE '))continue;
 try{records.push(JSON.parse(line.slice('GREIVA_IME_TRACE '.length)));}catch(error){errors.push({line:index+1,message:String(error)});}
}
const pages=[...new Set(records.map(r=>r.pageId))].map(pageId=>{
 const ordered=records.filter(r=>r.pageId===pageId).sort((a,b)=>a.seq-b.seq);
 const gaps=[];for(let i=1;i<ordered.length;i++)if(ordered[i].seq!==ordered[i-1].seq+1)gaps.push([ordered[i-1].seq,ordered[i].seq]);
 const input=ordered.filter(r=>['keydown','keyup','focus','blur','beforeinput','input','compositionstart','compositionupdate','compositionend','pm-transaction','y-update','probe-switch','probe-selection-direction'].includes(r.type));
 return {pageId,records:ordered.length,sequenceGaps:gaps,events:input.map(r=>({seq:r.seq,at:r.at,surface:r.surface,type:r.type,key:r.key,code:r.code,keyCode:r.keyCode,trusted:r.trusted,inputType:r.inputType,data:r.data,isComposing:r.isComposing,domSelection:r.domSelection,targetRanges:r.targetRanges,pm:r.pm,domText:r.domText,textarea:r.textarea,steps:r.steps,composition:r.composition,deletes:r.deletes,xml:r.xml,enabled:r.enabled,beforeSnapshot:r.beforeSnapshot,scope:r.scope}))};
});
const report={analyzedAt:new Date().toISOString(),records:records.length,parseErrors:errors,pages,scope:'Read-only analysis of diagnostic app stderr. Probe instrumentation is a source override; not a production native Pass or a complete physical keyboard trace outside the observed surfaces.'};
writeFileSync(outputPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({records:records.length,parseErrors:errors,pages:pages.map(p=>({pageId:p.pageId,records:p.records,sequenceGaps:p.sequenceGaps,lastEvents:p.events.slice(-4)}))},null,2));
