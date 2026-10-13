import { it, expect } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const driver='.data/crash-target/debug/examples/credential-crash-driver';
// All automated crash tests run in Docker with a presence-only OS double.
// Windows Credential Manager gets its own native synthetic probe evidence.
for(const scenario of [
  {mode:'logout',stage:'credential-lock-before-commit',restorable:true},
  {mode:'logout',stage:'credential-lock-after-commit',restorable:false},
  {mode:'activate',stage:'credential-os-written',restorable:false},
  {mode:'activate',stage:'credential-activated',restorable:true},
  {mode:'restore',stage:'credential-lock-after-commit',restorable:false},
  {mode:'restore',stage:'credential-os-written',restorable:false},
  {mode:'restore',stage:'credential-activated',restorable:true},
]) it(`NATIVE-CREDENTIAL: SIGKILL ${scenario.mode}/${scenario.stage} preserves durable lock boundary`,async()=>{
  const root=mkdtempSync(join(tmpdir(),'greiva-credential-crash-')),barrier=join(root,'barrier');let child:ReturnType<typeof spawn>|undefined;
  try {
    expect(existsSync('/.dockerenv')).toBe(true);
    const seeded=spawnSync(driver,[root,'activate'],{encoding:'utf8'});expect(seeded.status,seeded.stderr).toBe(0);
    writeFileSync(barrier+'.armed',scenario.stage);
    child=spawn(driver,[root,scenario.mode],{env:{...process.env,GREIVA_CRASH_BARRIER_ROOT:barrier},stdio:'ignore'});
    const stopped=new Promise<void>((resolve,reject)=>{child!.once('error',reject);child!.once('exit',()=>resolve());});
    await expect.poll(()=>existsSync(barrier+'.reached'),{timeout:8000}).toBe(true);child.kill('SIGKILL');await stopped;
    const restarted=spawnSync(driver,[root,'probe'],{encoding:'utf8'});expect(restarted.status,restarted.stderr).toBe(0);
    expect(JSON.parse(restarted.stdout)).toEqual({restorable:scenario.restorable});
  } finally {if(child?.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');rmSync(root,{recursive:true,force:true});}
},15000);
