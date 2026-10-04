import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

assert(fs.existsSync('/.dockerenv'), 'Build this diagnostic in Docker');
const out=path.resolve(process.argv[2]??'/tmp/greiva-windows-profile');
assert(!fs.existsSync(out), 'Refusing existing diagnostic output');
fs.mkdirSync(out,{recursive:true});
const config=JSON.parse(fs.readFileSync('apps/client/src-tauri/tauri.conf.json'));
const pageId='01a10530-0000-7000-8000-000000000001';
const override={identifier:'dev.greiva.poc.profile625',app:{windows:[{...config.app.windows[0],title:'Greiva Performance Diagnostic',url:'index.html?page='+pageId}]}};
const files=['apps/client/src/main.tsx','apps/client/src/editor/page-session.ts','apps/client/src/editor/PageEditor.tsx','apps/client/src/structured/TaskPanel.tsx','apps/client/src/editor/local-page-store.ts','apps/client/src-tauri/src/lib.rs'];
const originals=files.map(file=>fs.readFileSync(file));
const modulePath='apps/client/src/profile-diagnostic.ts';
assert(!fs.existsSync(modulePath));
for(const [index,bytes] of originals.entries())fs.writeFileSync(path.join(out,`original-${index}`),bytes);
const module=`import {invoke} from '@tauri-apps/api/core';
sessionStorage.setItem('greiva-connection-paused','1');
const records:unknown[]=[],longTasks:unknown[]=[];
export function probeMark(id:string,data:object={}){records.push({id,at:performance.now(),...data});}
export function probePaint(id:string,data:object={}){probeMark(id+'-effect',data);requestAnimationFrame(()=>requestAnimationFrame(()=>probeMark(id+'-two-raf',data)));}
export async function probeInvoke<T>(command:string,fields?:Record<string,unknown>):Promise<T>{const start=performance.now();try{return await invoke<T>(command,fields);}finally{probeMark('ipc',{command,start,duration:performance.now()-start});}}
probeMark('module-ready');
try{new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch{}
function flush(reason:string){const editor=document.querySelector('[aria-label="Page本文"]');const report={reason,at:new Date().toISOString(),timeOrigin:performance.timeOrigin,reportedAt:performance.now(),records,longTasks,navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),paints:performance.getEntriesByType('paint').map(e=>e.toJSON()),dom:{paragraphs:editor?.querySelectorAll(':scope > p').length,handles:document.querySelectorAll('.block-handle').length,editable:editor?.getAttribute('contenteditable'),save:document.querySelector('[aria-label="端末の保存状態"]')?.textContent}};void invoke('profile_record',{record:JSON.stringify(report)});}
setTimeout(()=>flush('startup'),5000);
let inputTimer:ReturnType<typeof setTimeout>|undefined;
for(const type of ['keydown','beforeinput','input','compositionstart','compositionend'])document.addEventListener(type,event=>{if(!(event.target as HTMLElement)?.closest('[aria-label="Page本文"]'))return;const start=performance.now(),key=event as KeyboardEvent,input=event as InputEvent;probeMark(type,{start,key:key.key,inputType:input.inputType,dataLength:input.data?.length??null,composing:key.isComposing??input.isComposing,trusted:event.isTrusted});requestAnimationFrame(()=>requestAnimationFrame(()=>probeMark(type+'-two-raf',{start,duration:performance.now()-start})));clearTimeout(inputTimer);inputTimer=setTimeout(()=>flush('input'),1000);},true);
`;
const rust=`
struct PerfProbe { started: std::time::Instant, spans: std::sync::Mutex<Vec<serde_json::Value>> }
fn profile_span(probe: &PerfProbe,id: &str,start: std::time::Instant){probe.spans.lock().unwrap().push(serde_json::json!({"id":id,"start":start.duration_since(probe.started).as_secs_f64()*1000.0,"duration":start.elapsed().as_secs_f64()*1000.0}));}
#[tauri::command]
fn profile_record(record:String,state:tauri::State<'_,LocalStore>,probe:tauri::State<'_,PerfProbe>)->Result<(),String>{use std::io::Write;let frontend:serde_json::Value=serde_json::from_str(&record).map_err(|e|e.to_string())?;let report=serde_json::json!({"frontend":frontend,"nativeElapsed":probe.started.elapsed().as_secs_f64()*1000.0,"nativeSpans":*probe.spans.lock().unwrap()});let file=state.path.parent().ok_or("Missing diagnostic directory")?.join("profile.jsonl");let mut writer=std::fs::OpenOptions::new().create(true).append(true).open(file).map_err(|e|e.to_string())?;writeln!(writer,"{}",report).map_err(|e|e.to_string())}
`;
function replace(file,needle,value){const source=fs.readFileSync(file,'utf8');assert.equal(source.split(needle).length,2,'Injection must be unique: '+file+' '+needle.slice(0,60));fs.writeFileSync(file,source.replace(needle,value));}
const results=[];let artifact=null;
const env={...process.env,VITE_GREIVA_TEST_HOOKS:'0',VITE_GREIVA_TEST_SQLITE:'0',CARGO_BUILD_JOBS:'2',TAURI_CONFIG:JSON.stringify(override)};
try{
 fs.writeFileSync(modulePath,module);
 for(const file of files.filter(file=>/\.tsx?$/.test(file)))fs.writeFileSync(file,`import {probeMark,probePaint,probeInvoke} from '${file.includes('/editor/')||file.includes('/structured/')?'../':'./'}profile-diagnostic';\n`+fs.readFileSync(file,'utf8'));
 replace(files[1],'  let selectedPageId = pageId;','  probeMark("session-start");\n  let selectedPageId = pageId;');
 replace(files[1],"      for (const bytes of saved.updates) { const updateBytes = Uint8Array.from(bytes); Y.decodeUpdate(updateBytes); Y.applyUpdate(document, updateBytes, 'restore'); }",`      const start=performance.now();let arrays=0,decode=0,apply=0,totalBytes=0;for(const bytes of saved.updates){let at=performance.now();const updateBytes=Uint8Array.from(bytes);arrays+=performance.now()-at;totalBytes+=bytes.length;at=performance.now();Y.decodeUpdate(updateBytes);decode+=performance.now()-at;at=performance.now();Y.applyUpdate(document,updateBytes,'restore');apply+=performance.now()-at;}probeMark('yjs-restore',{start,duration:performance.now()-start,arrays,decode,apply,updates:saved.updates.length,bytes:totalBytes,blocks:document.getXmlFragment('body').length});`);
 replace(files[2],'  const extensions = useMemo(',"  probeMark('editor-render');\n  const extensions = useMemo(");
 replace(files[2],'  useEffect(() => { if (editor &&',"  useEffect(()=>{if(editor)probePaint('editor',{blocks:editor.getJSON().content?.length});},[editor]);\n  useEffect(() => { if (editor &&");
 replace(files[3],'  const tasks = snapshot?.tasks.filter',"  useEffect(()=>{if(snapshot)probePaint('tasks',{tasks:snapshot.tasks.length});},[snapshot]);\n  const tasks = snapshot?.tasks.filter");
 replace(files[4],"list: () => invoke('page_list'),","list: () => probeInvoke('page_list'),");
 replace(files[4],"load: pageId => invoke('page_load', { pageId }),","load: pageId => probeInvoke('page_load', { pageId }),");
 replace(files[4],"append: (pageId, update) => invoke('page_append', { pageId, update: Array.from(update) }),","append: (pageId, update) => probeInvoke('page_append', { pageId, update: Array.from(update) }),");
 fs.writeFileSync(files[5],fs.readFileSync(files[5],'utf8').replaceAll('\r\n','\n'));
 replace(files[5],'pub fn run() {','pub fn run() {\n    let profile_started=std::time::Instant::now();');
 replace(files[5],'.setup(|app| {','.setup(move |app| {');
 replace(files[5],'            app.manage(LocalStore {','            app.manage(PerfProbe{started:profile_started,spans:std::sync::Mutex::new(Vec::new())});\n            app.manage(LocalStore {');
 replace(files[5],'#[cfg_attr(mobile, tauri::mobile_entry_point)]',rust+'\n#[cfg_attr(mobile, tauri::mobile_entry_point)]');
 replace(files[5],'![page_list,','![profile_record, page_list,');
 for(const [name,type,call] of [['page_list','Vec<PageMetadata>','list()'],['page_load','StoredPage','load(&page_id)'],['structured_snapshot','StructuredSnapshot','structured_snapshot()']]){
  const signature=`async fn ${name}(${name==='page_load'?'page_id: String, ':''}state: tauri::State<'_, LocalStore>)`;
  const original=`${signature} -> Result<${type}, String> {\n    state.get().await?.${call}.await\n}`;
  const instrumented=signature.slice(0,-1)+", probe: tauri::State<'_, PerfProbe>)";
  replace(files[5],original,`${instrumented} -> Result<${type}, String> {let start=std::time::Instant::now();let store=state.get().await?;profile_span(&probe,"${name}-store-open",start);let start=std::time::Instant::now();let value=store.${call}.await;profile_span(&probe,"${name}-query",start);value}`);
 }
 for(const [id,exe,args] of [['frontend','npm',['run','build']],['cross','cargo',['xwin','build','--release','--offline','--locked','--manifest-path','apps/client/src-tauri/Cargo.toml','--target','x86_64-pc-windows-msvc','--features','custom-protocol','--target-dir','.data/windows-target']]]){
  const start=new Date().toISOString(),r=spawnSync(exe,args,{env,encoding:'utf8',maxBuffer:128*1024*1024});fs.writeFileSync(path.join(out,id+'.log'),(r.stdout??'')+(r.stderr??''));results.push({id,exit:r.status,start,finished:new Date().toISOString()});console.log(id+': '+r.status);assert.equal(r.status,0,id);
 }
 const executable='.data/windows-target/x86_64-pc-windows-msvc/release/greiva-poc.exe',bytes=fs.readFileSync(executable);artifact={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};fs.copyFileSync(executable,path.join(out,'greiva-poc.exe'));
}finally{
 for(const [index,file] of files.entries())fs.writeFileSync(file,originals[index]);
 if(fs.existsSync(modulePath))fs.unlinkSync(modulePath);
 const restored=files.map((file,index)=>{assert(fs.readFileSync(file).equals(originals[index]));return{file,sha256:createHash('sha256').update(originals[index]).digest('hex')};});
 fs.writeFileSync(path.join(out,'build.json'),JSON.stringify({at:new Date().toISOString(),product:config.version,diagnostic:true,override,pageId,results,artifact,restored,module,rust,scope:'Read-only timing instrumented Windows Tauri; paused synthetic fixture. Not a normal executable, physical input, actual IME, paint presentation or SLO proof.'},null,2)+'\n');
}
