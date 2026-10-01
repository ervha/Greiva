import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,statSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory='/evidence/step8-ime-trace-build';mkdirSync(directory,{recursive:true});
const files=JSON.parse(readFileSync('/evidence/2026-10-01T09-55-17.294Z/source-files.json','utf8'));
const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update('\0');hash.update(readFileSync(file));}
const baselineSha256=hash.digest('hex');if(baselineSha256!=='c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205')throw Error('Probe baseline differs from verified 0.6.5');
const editorPath='apps/client/src/editor/PageEditor.tsx',rustPath='apps/client/src-tauri/src/lib.rs',configPath='apps/client/src-tauri/tauri.conf.json';
const original=new Map([editorPath,rustPath,configPath].map(file=>[file,readFileSync(file)]));
const env={...process.env,VITE_GREIVA_TEST_HOOKS:'0',VITE_GREIVA_TEST_SQLITE:'0',CARGO_BUILD_JOBS:'2'};
const results=[];let artifact=null;
function run(id,command,args){const startedAt=new Date().toISOString();const r=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:64*1024*1024});writeFileSync(`${directory}/${id}.log`,`${r.stdout??''}${r.stderr??''}${r.error?.message??''}`);results.push({id,command:[command,...args],startedAt,finishedAt:new Date().toISOString(),exitCode:r.status});console.log(`${id}: ${r.status===0?'Pass':'Fail'}`);return r.status===0;}
try {
 copyFileSync('/workspace/.data/native-ime-trace.ts','apps/client/src/editor/native-ime-trace.ts');
 let editor=original.get(editorPath).toString();editor="import { installImeTrace } from './native-ime-trace';\n"+editor;
 const anchor='  const state = useEditorState(';if(!editor.includes(anchor))throw Error('Editor anchor missing');
 editor=editor.replace(anchor,"  useEffect(() => { if (editor) return installImeTrace(editor, session.document, session.pageId); }, [editor, session.document, session.pageId]);\n"+anchor);writeFileSync(editorPath,editor);
 let rust=original.get(rustPath).toString();const rustAnchor='#[cfg_attr(mobile, tauri::mobile_entry_point)]';
 rust=rust.replace(rustAnchor,'#[tauri::command]\nfn ime_trace(record: serde_json::Value) { eprintln!("GREIVA_IME_TRACE {}", record); }\n'+rustAnchor).replace('tauri::generate_handler![page_list','tauri::generate_handler![ime_trace, page_list');writeFileSync(rustPath,rust);
 const config=JSON.parse(original.get(configPath));config.identifier='dev.greiva.poc.ime-trace';config.app.windows[0].title='Greiva IME診断';writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
 const probePaths=[editorPath,rustPath,configPath,'apps/client/src/editor/native-ime-trace.ts'];
 const overrides=probePaths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
 writeFileSync(`${directory}/overrides.json`,JSON.stringify(overrides,null,2));for(const file of probePaths)copyFileSync(file,`${directory}/${file.split('/').at(-1)}`);
 if(run('PROBE-FRONTEND','npm',['run','build','--workspace=@greiva/client']) && run('PROBE-CROSS-BUILD','cargo',['xwin','build','--offline','--locked','--manifest-path','apps/client/src-tauri/Cargo.toml','--target','x86_64-pc-windows-msvc','--features','custom-protocol','--target-dir','.data/windows-target'])) {
  const path='.data/windows-target/x86_64-pc-windows-msvc/debug/greiva-poc.exe';artifact={sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),bytes:statSync(path).size};copyFileSync(path,`${directory}/greiva-poc.exe`);
 }
} finally {
 for(const [file,bytes] of original)writeFileSync(file,bytes);
 writeFileSync(`${directory}/build.json`,JSON.stringify({at:new Date().toISOString(),baselineVersion:'0.6.5',baselineCommit:'c6b1c8bde39996cd7b5bcbca5f737b6106789680',baselineSha256,artifact,results,scope:'Diagnostic-only modified 0.6.5 baseline, local stderr event/selection trace and plain-input comparisons. Not a normal product artifact or production native Pass.'},null,2));
 process.exitCode=artifact?0:1;
}
