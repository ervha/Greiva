import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out='/tmp/greiva-drag-probe';mkdirSync(out,{recursive:true});
const main='apps/client/src/main.tsx',lib='apps/client/src-tauri/src/lib.rs';
const originalMain=readFileSync(main,'utf8'),originalLib=readFileSync(lib,'utf8');
const logger=`
// DIAGNOSTIC COPY ONLY: observe real native input without synthesizing events.
import {invoke as dragProbeInvoke} from '@tauri-apps/api/core';
const dragProbeLines:string[]=[];let dragProbeQueue=Promise.resolve();
const dragProbeOutput=document.createElement('pre');
dragProbeOutput.setAttribute('aria-label','Drag event diagnosis');
dragProbeOutput.style.cssText='position:fixed;right:16px;bottom:16px;width:400px;height:180px;overflow:hidden;background:#fff;border:1px solid #777;font:11px monospace;z-index:200;pointer-events:none';
document.body.append(dragProbeOutput);
for(const type of ['pointerdown','mousedown','pointerup','mouseup','dragstart','dragenter','dragover','drop','dragend'])document.addEventListener(type,event=>{
 const mouse=event as MouseEvent,drag=event as DragEvent,target=event.target as HTMLElement;
 const record={at:new Date().toISOString(),type,trust:event.isTrusted,x:mouse.clientX,y:mouse.clientY,buttons:mouse.buttons,target:target.tagName,class:target.className,aria:target.getAttribute('aria-label'),types:Array.from(drag.dataTransfer?.types??[]),handles:type==='pointerdown'?Array.from(document.querySelectorAll('.block-handle')).map(e=>({label:e.getAttribute('aria-label'),rect:e.getBoundingClientRect().toJSON()})):undefined};
 setTimeout(()=>{const line=JSON.stringify({...record,prevented:event.defaultPrevented});dragProbeLines.push(line);dragProbeOutput.textContent=dragProbeLines.slice(-8).join('\\n');dragProbeQueue=dragProbeQueue.then(()=>dragProbeInvoke<void>('drag_probe_record',{record:line})).catch(e=>{dragProbeOutput.textContent+='\\nLOG ERROR '+String(e);});},0);
},true);
const control=document.createElement('div');control.style.cssText='position:fixed;right:24px;top:470px;width:220px;background:#ecf6ee;padding:12px;z-index:100';
const source=document.createElement('div');source.textContent='HTML5 control: drag this';source.draggable=true;source.id='probe-source';source.style.cssText='border:1px solid #467;padding:8px';source.addEventListener('dragstart',e=>{e.dataTransfer!.setData('text/plain','probe');});
const target=document.createElement('div');target.textContent='Drop control here';target.id='probe-target';target.style.cssText='margin-top:12px;padding:12px;border:1px dashed #467';target.addEventListener('dragover',e=>e.preventDefault());target.addEventListener('drop',e=>{e.preventDefault();target.textContent='CONTROL DROP OK';});control.append(source,target);document.body.append(control);
`;
const command=`
// DIAGNOSTIC COPY ONLY: separate append-only event file, no SQLite mutation.
#[tauri::command]
fn drag_probe_record(record: String, state: tauri::State<'_, LocalStore>) -> Result<(), String> {
 use std::io::Write;
 let path=state.path.parent().ok_or("Missing diagnosis directory")?.join("drag-probe.jsonl");
 let mut file=std::fs::OpenOptions::new().create(true).append(true).open(path).map_err(|e|e.to_string())?;
 writeln!(file,"{}",record).map_err(|e|e.to_string())
}
`;
const base=JSON.parse(readFileSync('apps/client/src-tauri/tauri.conf.json','utf8'));
const override={identifier:'dev.greiva.poc.dragprobe617',app:{windows:[{...base.app.windows[0],title:'Greiva Drag Diagnosis',url:'index.html?page=01a10250-0000-7000-8000-000000000001'}]}};
const env={...process.env,VITE_GREIVA_TEST_HOOKS:'0',VITE_GREIVA_TEST_SQLITE:'0',CARGO_BUILD_JOBS:'2',TAURI_CONFIG:JSON.stringify(override)};
let artifact=null;const checks=[];
try{
 writeFileSync(main,originalMain+logger);writeFileSync(lib,originalLib.replace('#[cfg_attr(mobile, tauri::mobile_entry_point)]',command+'\n#[cfg_attr(mobile, tauri::mobile_entry_point)]').replace('![page_list,','![drag_probe_record, page_list,'));
 for(const [id,exe,args] of [['frontend','npm',['run','build']],['cross','cargo',['xwin','build','--release','--offline','--locked','--manifest-path','apps/client/src-tauri/Cargo.toml','--target','x86_64-pc-windows-msvc','--features','custom-protocol','--target-dir','.data/windows-target']]]){const result=spawnSync(exe,args,{env,encoding:'utf8',maxBuffer:128*1024*1024});writeFileSync(out+'/'+id+'.log',(result.stdout??'')+(result.stderr??''));checks.push({id,exit:result.status});console.log(id+': '+result.status);if(result.status!==0)throw Error(id+' failed');}
 const path='.data/windows-target/x86_64-pc-windows-msvc/release/greiva-poc.exe';artifact={path,bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};
}finally{
 writeFileSync(main,originalMain);writeFileSync(lib,originalLib);
 writeFileSync(out+'/build.json',JSON.stringify({at:new Date().toISOString(),version:'0.6.17 diagnosis only',override,logger,command,artifact,checks,scope:'Instrumented isolated diagnostic artifact. Not product acceptance. Frontend source and Rust lib restored after build.'},null,2));
}
