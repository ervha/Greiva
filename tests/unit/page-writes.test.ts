import {it,expect} from 'vitest';
import * as Y from 'yjs';
import {DurabilityBoundary,PageWrites,type LocalPageStore} from '../../apps/client/src/editor/local-page-store.js';

function updates() {
  const doc=new Y.Doc(); const bytes:Uint8Array[]=[];
  doc.on('update',(update:Uint8Array)=>bytes.push(update));
  for(let i=0;i<201;i++) doc.getText('test').insert(i,String.fromCharCode(97+i%26));
  doc.getText('test').delete(30,15);
  return {doc,bytes};
}
function store(append:LocalPageStore['append'],setTitle:LocalPageStore['setTitle']=async()=>{}) : LocalPageStore {
  return {append,setTitle,list:async()=>[],load:async()=>{throw new Error('not used');}};
}
it('STEP7-PAGE-BATCH: commits a burst behind an in-flight write in one batch, with identical full Yjs state',async()=> {
  const {doc,bytes}=updates();const restored=new Y.Doc();restored.getText('test');const calls:Uint8Array[]=[];
  let release=()=>{};const gate=new Promise<void>(done=> {release=done;});
  const boundary=new DurabilityBoundary(()=>{});
  const writes=new PageWrites(boundary,store(async(_page,update)=> {
    calls.push(update);if(calls.length===1) await gate;Y.applyUpdate(restored,update);
  }),'page');
  writes.append(bytes[0]!);await Promise.resolve();expect(calls).toHaveLength(1);
  const firstFrame=boundary.tail;
  for(const update of bytes.slice(1)) writes.append(update);
  const lastFrame=boundary.tail;let sent=false;void lastFrame.then(()=> {sent=true;});
  expect(boundary.pending).toBe(2);expect(sent).toBe(false);expect(calls).toHaveLength(1);
  release();await firstFrame;await lastFrame;
  expect(sent).toBe(true);expect(calls).toHaveLength(2);expect(boundary.pending).toBe(0);
  expect(restored.toJSON()).toEqual(doc.toJSON());
  expect(Array.from(Y.encodeStateVector(restored))).toEqual(Array.from(Y.encodeStateVector(doc)));
  doc.destroy();restored.destroy();
});
it('STEP7-PAGE-BATCH-ORDER: metadata separates batches and append copies caller-owned bytes',async()=> {
  const {doc,bytes}=updates();const order:string[]=[];const committed:Uint8Array[]=[];
  const boundary=new DurabilityBoundary(()=>{});let release=()=>{};const gate=new Promise<void>(done=> {release=done;});
  const writes=new PageWrites(boundary,store(async(_page,update)=> {
    order.push('update');committed.push(update);if(order.length===1) await gate;
  },async(_page,title)=> {order.push(title);}), 'page');
  const original=bytes[0]!.slice();writes.append(bytes[0]!);bytes[0]!.fill(0);await Promise.resolve();
  writes.append(bytes[1]!);writes.setTitle('title');writes.append(bytes[2]!);
  release();await boundary.tail;
  expect(order).toEqual(['update','update','title','update']);expect(committed[0]).toEqual(original);
  expect(committed[1]).toEqual(bytes[1]);expect(committed[2]).toEqual(bytes[2]);doc.destroy();
});
it('STEP7-PAGE-BATCH-ERROR: a failed commit blocks queued batches and their outgoing-frame promise',async()=> {
  const {doc,bytes}=updates();let calls=0;let release=()=>{};const gate=new Promise<void>(done=> {release=done;});
  const boundary=new DurabilityBoundary(()=>{});
  const writes=new PageWrites(boundary,store(async()=> {calls++;await gate;throw new Error('disk full');}),'page');
  writes.append(bytes[0]!);await Promise.resolve();for(const update of bytes.slice(1)) writes.append(update);
  release();await expect(boundary.tail).rejects.toThrow('disk full');expect(calls).toBe(1);expect(boundary.pending).toBe(2);doc.destroy();
});
