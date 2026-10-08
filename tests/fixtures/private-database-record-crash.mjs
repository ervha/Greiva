import pg from 'pg';
import {PostgresPrivateDatabaseRecordStore} from '../../apps/api/dist/private-database-record-store.js';
// Test-only real-driver barrier. No product crash hook or private output.
const [schema,boundary,wire]=process.argv.slice(2),input=JSON.parse(wire);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,statement_timeout:5000});
const connect=pool.connect.bind(pool);
pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);client.query=async(...args)=>{if(args[0]==='COMMIT'&&boundary==='before-commit'){process.send({event:'boundary',boundary});await new Promise(()=>{});}const result=await query(...args);if(args[0]==='COMMIT'&&boundary==='after-commit'){process.send({event:'boundary',boundary});await new Promise(()=>{});}return result;};return client;};
try{await new PostgresPrivateDatabaseRecordStore(pool,schema).write(input.owner,input.workspaceId,input.sourceId,input.request);process.send({event:'unexpected-completion'});process.exitCode=1;}catch{process.send({event:'failed'});process.exitCode=1;}finally{await pool.end();process.disconnect();}
