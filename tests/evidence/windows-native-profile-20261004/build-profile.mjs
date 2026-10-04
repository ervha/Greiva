import {readFileSync,writeFileSync,mkdirSync,statSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out='/tmp/greiva-native-profile';mkdirSync(out,{recursive:true});
const paths=['apps/client/src/main.tsx','apps/client/src/editor/page-session.ts','apps/client/src/editor/PageEditor.tsx','apps/client/src/structured/TaskPanel.tsx','apps/client/src/editor/local-page-store.ts','apps/client/src-tauri/src/lib.rs'];
const originals=Object.fromEntries(paths.map(p=>[p,readFileSync(p,'utf8')]));
const modulePath='apps/client/src/profile-diagnostic.ts';
const module=`import {invoke} from '@tauri-apps/api/core';
sessionStorage.setItem('greiva-connection-paused','1');
const records:unknown[]=[];
export function probeMark(id:string,data:object={}){records.push({id,at:performance.now(),...data});}
export function probePaint(id:string,data:object={}){probeMark(id+'-effect',data);requestAnimationFrame(()=>requestAnimationFrame(()=>{probeMark(id+'-two-raf',{...data,domChildren:document.querySelector('.tiptap')?.children.length,paragraphs:document.querySelectorAll('.tiptap > p').length,handles:document.querySelectorAll('.block-handle').length});}));}
export async function probeInvoke<T>(command:string,fields?:Record<string,unknown>):Promise<T>{const start=performance.now();try{return await invoke<T>(command,fields);}finally{probeMark('ipc',{command,start,duration:performance.now()-start});}}
probeMark('module-ready');
const longTasks:unknown[]=[];try{new PerformanceObserver(list=>{for(const e of list.getEntries())longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});}catch{}
function flush(reason:string){const record={reason,at:new Date().toISOString(),timeOrigin:performance.timeOrigin,reportedAt:performance.now(),records,longTasks,navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),paints:performance.getEntriesByType('paint').map(e=>e.toJSON()),dom:{domChildren:document.querySelector('.tiptap')?.children.length,paragraphs:document.querySelectorAll('.tiptap > p').length,handles:document.querySelectorAll('.block-handle').length,editable:document.querySelector('.tiptap')?.getAttribute('contenteditable'),save:document.querySelector('[aria-label="端末の保存状態"]')?.textContent}};void invoke('profile_record',{record:JSON.stringify(record)});}
setTimeout(()=>flush('startup'),5000);
let inputTimer:ReturnType<typeof setTimeout>|undefined;
for(const type of ['keydown','beforeinput','input','compositionstart','compositionend'])document.addEventListener(type,event=>{if(!(event.target as HTMLElement)?.closest('.tiptap'))return;const start=performance.now(),key=event as KeyboardEvent,input=event as InputEvent;probeMark(type,{start,key:key.key,inputType:input.inputType,composing:key.isComposing??input.isComposing,trusted:event.isTrusted});requestAnimationFrame(()=>requestAnimationFrame(()=>probeMark(type+'-two-raf',{start,duration:performance.now()-start})));clearTimeout(inputTimer);inputTimer=setTimeout(()=>flush('input'),1000);},true);
`;
const rust=`
struct PerfProbe { started: std::time::Instant, spans: std::sync::Mutex<Vec<serde_json::Value>> }
fn profile_span(probe: &PerfProbe, id: &str, start: std::time::Instant, data: serde_json::Value) {
 probe.spans.lock().unwrap().push(serde_json::json!({"id":id,"start":start.duration_since(probe.started).as_secs_f64()*1000.0,"duration":start.elapsed().as_secs_f64()*1000.0,"data":data}));
}
#[tauri::command]
fn profile_record(record: String, state: tauri::State<'_, LocalStore>, probe: tauri::State<'_, PerfProbe>) -> Result<(), String> {
 use std::io::Write;
 let frontend:serde_json::Value=serde_json::from_str(&record).map_err(|e|e.to_string())?;
 let report=serde_json::json!({"frontend":frontend,"nativeElapsed":probe.started.elapsed().as_secs_f64()*1000.0,"nativeSpans":*probe.spans.lock().unwrap()});
 let path=state.path.parent().ok_or("Missing diagnostic directory")?.join("profile.jsonl");
 let mut file=std::fs::OpenOptions::new().create(true).append(true).open(path).map_err(|e|e.to_string())?;
 writeln!(file,"{}",report).map_err(|e|e.to_string())
}
`;
function replace(path,needle,value){const text=readFileSync(path,'utf8');if(!text.includes(needle))throw Error('Missing injection: '+path+' '+needle.slice(0,60));writeFileSync(path,text.replace(needle,value));}
const base=JSON.parse(readFileSync('apps/client/src-tauri/tauri.conf.json'));
const override={identifier:'dev.greiva.poc.profile617',app:{windows:[{...base.app.windows[0],title:'Greiva Restore Profile',url:'index.html?page=01a10230-0000-7000-8000-000000000001'}]}};
const env={...process.env,VITE_GREIVA_TEST_HOOKS:'0',VITE_GREIVA_TEST_SQLITE:'0',CARGO_BUILD_JOBS:'2',TAURI_CONFIG:JSON.stringify(override)};
const results=[];let artifact=null;
try{
 writeFileSync(modulePath,module);
 for(const path of paths.filter(p=>p.endsWith('.ts')||p.endsWith('.tsx')))writeFileSync(path,`import {probeMark,probePaint,probeInvoke} from '${path.includes('/editor/')||path.includes('/structured/')?'../':'./'}profile-diagnostic';\n`+originals[path]);
 replace(paths[1],'  let selectedPageId = pageId;','  probeMark("session-start");\n  let selectedPageId = pageId;');
 replace(paths[1],"      for (const bytes of saved.updates) { const updateBytes = Uint8Array.from(bytes); Y.decodeUpdate(updateBytes); Y.applyUpdate(document, updateBytes, 'restore'); }",`      const restoreStart=performance.now();let arrays=0,decode=0,apply=0,totalBytes=0;
      for(const bytes of saved.updates){let start=performance.now();const updateBytes=Uint8Array.from(bytes);arrays+=performance.now()-start;totalBytes+=bytes.length;start=performance.now();Y.decodeUpdate(updateBytes);decode+=performance.now()-start;start=performance.now();Y.applyUpdate(document,updateBytes,'restore');apply+=performance.now()-start;}
      probeMark('yjs-restore',{start:restoreStart,duration:performance.now()-restoreStart,arrays,decode,apply,updates:saved.updates.length,bytes:totalBytes,blocks:document.getXmlFragment('body').length});`);
 replace(paths[2],'  const extensions = useMemo(',`  probeMark('editor-render');
  const extensions = useMemo(`);
 replace(paths[2],'  useEffect(() => { if (editor &&',`  useEffect(()=>{if(editor)probePaint('editor',{blocks:editor.getJSON().content?.length});},[editor]);
  useEffect(() => { if (editor &&`);
 replace(paths[3],'  const tasks = snapshot?.tasks.filter',`  useEffect(()=>{if(snapshot)probePaint('tasks',{tasks:snapshot.tasks.length});},[snapshot]);
  const tasks = snapshot?.tasks.filter`);
 // Record only Page IPC; structured native spans are captured below.
 replace(paths[4],"list: () => invoke('page_list'),","list: () => probeInvoke('page_list'),");
 replace(paths[4],"load: pageId => invoke('page_load', { pageId }),","load: pageId => probeInvoke('page_load', { pageId }),");
 replace(paths[4],"append: (pageId, update) => invoke('page_append', { pageId, update: Array.from(update) }),","append: (pageId, update) => probeInvoke('page_append', { pageId, update: Array.from(update) }),");
 let lib=originals[paths[5]].replaceAll('\r\n','\n');
 lib=lib.replace('pub fn run() {','pub fn run() {\n    let profile_started=std::time::Instant::now();');
 lib=lib.replace('.setup(|app| {','.setup(move |app| {');
 lib=lib.replace('            app.manage(LocalStore {', '            app.manage(PerfProbe{started:profile_started,spans:std::sync::Mutex::new(Vec::new())});\n            app.manage(LocalStore {');
 lib=lib.replace('#[cfg_attr(mobile, tauri::mobile_entry_point)]',rust+'\n#[cfg_attr(mobile, tauri::mobile_entry_point)]').replace('![page_list,','![profile_record, page_list,');
 for(const [name,type,call] of [['page_list','Vec<PageMetadata>','list()'],['page_load','StoredPage','load(&page_id)'],['structured_snapshot','StructuredSnapshot','structured_snapshot()']]){
  const old=name==='page_load'?`async fn ${name}(page_id: String, state: tauri::State<'_, LocalStore>) -> Result<${type}, String> {\n    state.get().await?.${call}.await\n}`:`async fn ${name}(state: tauri::State<'_, LocalStore>) -> Result<${type}, String> {\n    state.get().await?.${call}.await\n}`;
  const signature=old.slice(0,old.indexOf(' ->')).replace(")",", probe: tauri::State<'_, PerfProbe>)");
  const body=`${signature} -> Result<${type}, String> { let start=std::time::Instant::now();let store=state.get().await?;profile_span(&probe,"${name}-store-open",start,serde_json::json!({}));let start=std::time::Instant::now();let value=store.${call}.await;profile_span(&probe,"${name}-query",start,serde_json::json!({}));value }`;
  if(!lib.includes(old))throw Error('Rust injection missing '+name);lib=lib.replace(old,body);
 }
 writeFileSync(paths[5],lib);
 for(const [id,exe,args] of [['frontend','npm',['run','build']],['cross','cargo',['xwin','build','--release','--offline','--locked','--manifest-path','apps/client/src-tauri/Cargo.toml','--target','x86_64-pc-windows-msvc','--features','custom-protocol','--target-dir','.data/windows-target']]]){
  const r=spawnSync(exe,args,{env,encoding:'utf8',maxBuffer:128*1024*1024});writeFileSync(`${out}/${id}.log`,`${r.stdout??''}${r.stderr??''}`);results.push({id,exit:r.status});console.log(id+': '+r.status);if(r.status!==0)throw Error(id+' failed');
 }
 const path='.data/windows-target/x86_64-pc-windows-msvc/release/greiva-poc.exe';artifact={path,bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};
}finally{
 for(const path of paths)writeFileSync(path,originals[path]);unlinkSync(modulePath);
 writeFileSync(out+'/build.json',JSON.stringify({at:new Date().toISOString(),product:'0.6.17 diagnostic only',override,sourceHashes:paths.map(path=>({path,sha256:createHash('sha256').update(originals[path]).digest('hex')})),module,rust,results,artifact,scope:'Read-only timing diagnosis, forced paused session, separate identifier and DB. Not normal-release SLO or actual IME evidence. Sources restored after build.'},null,2));
}
