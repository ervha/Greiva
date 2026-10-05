import pg from 'pg';
import { PostgresPrivateStructuredStore } from '../../apps/api/dist/private-structured-store.js';
// Test worker only. Instrument a real driver port; no product crash hooks.
const [schema,boundary,wire]=process.argv.slice(2),request=JSON.parse(wire);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});
const connect=pool.connect.bind(pool);
pool.connect=async()=>{
  const client=await connect(),query=client.query.bind(client);
  client.query=async(...args)=>{
    if(args[0]==='COMMIT' && boundary==='before-commit'){process.send({event:'boundary',boundary});await new Promise(()=>{});}
    const result=await query(...args);
    if(args[0]==='COMMIT' && boundary==='after-commit'){process.send({event:'boundary',boundary});await new Promise(()=>{});}
    return result;
  };return client;
};
try{
  await new PostgresPrivateStructuredStore(pool,schema).push({issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner',expiresAt:Math.floor(Date.now()/1000)+300},request.workspaceId,request);
  process.send({event:'unexpected-completion'});process.exitCode=1;
}catch{process.send({event:'failed'});process.exitCode=1;}finally{await pool.end();process.disconnect();}
