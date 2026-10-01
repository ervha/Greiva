import {it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'vite';
import {newId} from '@greiva/shared';
import {sqliteBridge} from '../support/sqlite-bridge.js';

it('STEP8-BRIDGE: killing a real Rust store during concurrent requests never terminates the HTTP server',async()=>{
  const root=mkdtempSync(join(tmpdir(),'greiva-bridge-stream-'));const device=newId();
  const previousRoot=process.env.GREIVA_TEST_STORE_DIR;const previousDriver=process.env.GREIVA_STORE_DRIVER;
  process.env.GREIVA_TEST_STORE_DIR=root;process.env.GREIVA_STORE_DRIVER=resolve('.data/native-target/debug/examples/store-driver');
  const server=await createServer({configFile:false,root,appType:'custom',plugins:[sqliteBridge()],server:{host:'127.0.0.1',port:0}});
  try{
    await server.listen();const address=server.httpServer!.address();if(!address || typeof address==='string')throw new Error('Missing test port');
    const base=`http://127.0.0.1:${address.port}`;
    const request=(path:string,command:string,padding?:string)=>fetch(`${base}/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device,command,padding}),signal:AbortSignal.timeout(10_000)});
    for(let round=0;round<4;round++){
      const initial=await request('__greiva_test_store','structured-snapshot');expect(initial.status).toBe(200);expect((await initial.json()).value).toBeDefined();
      // Backpressure leaves actual stdin writes in flight when the child dies.
      const concurrent=Array.from({length:40},()=>request('__greiva_test_store','structured-snapshot','x'.repeat(128*1024)));
      const killed=await request('__greiva_test_store_control','kill');expect(killed.status).toBe(200);expect((await killed.json()).value.signal).toBe('SIGKILL');
      for(const response of await Promise.all(concurrent)){expect(response.status).toBe(200);const reply=await response.json();expect(reply.value!==undefined || reply.error==='Rust SQLite process terminated').toBe(true);}
      const recovered=await request('__greiva_test_store','structured-snapshot');expect(recovered.status).toBe(200);expect((await recovered.json()).value).toBeDefined();
    }
  }finally{
    await server.close();
    if(previousRoot===undefined)delete process.env.GREIVA_TEST_STORE_DIR;else process.env.GREIVA_TEST_STORE_DIR=previousRoot;
    if(previousDriver===undefined)delete process.env.GREIVA_STORE_DRIVER;else process.env.GREIVA_STORE_DRIVER=previousDriver;
    rmSync(root,{recursive:true,force:true});
  }
},30_000);
