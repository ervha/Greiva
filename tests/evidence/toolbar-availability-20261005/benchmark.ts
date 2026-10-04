import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { adjacentBlockMove, canMoveAdjacentBlock } from '../../../apps/client/src/editor/blocks.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const schema = new Schema({ nodes: { doc:{content:'paragraph+'}, paragraph:{content:'text*'}, text:{} } });
const doc=schema.node('doc',null,Array.from({length:1000},(_,i)=>schema.node('paragraph',null,schema.text(`Block ${i}`))));
let pos=0;doc.forEach((_,offset,index)=>{if(index===500)pos=offset+1;});
const state=EditorState.create({doc,selection:TextSelection.create(doc,pos)});
const variants={legacy:()=>[Boolean(adjacentBlockMove(state,-1)),Boolean(adjacentBlockMove(state,1))],boundary:()=>[canMoveAdjacentBlock(state,-1),canMoveAdjacentBlock(state,1)]};
for(const variant of Object.values(variants))assert.deepEqual(variant(),[true,true]);
const runs=[];
for(let run=0;run<6;run++){
 const sample={run} as {run:number;legacy?:number;boundary?:number};
 for(const name of (run%2?['boundary','legacy']:['legacy','boundary']) as Array<keyof typeof variants>){
  for(let warmup=0;warmup<50;warmup++)variants[name]();
  const start=performance.now();for(let i=0;i<1000;i++)variants[name]();sample[name]=performance.now()-start;
 }
 runs.push(sample);
}
assert(state.doc===doc);
const result={at:new Date().toISOString(),blocks:1000,checksPerSample:1000,runs,documentUnchanged:true,scope:'Docker Node microbenchmark of two toolbar availability checks. Alternating order, 50 warmups. Not browser input latency, native IME, paint or startup SLO.'};
fs.writeFileSync('/tmp/toolbar0624/benchmark.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
