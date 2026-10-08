import pg from 'pg';
import {PostgresPrivatePageMetadataStore} from '../../apps/api/dist/private-page-metadata-store.js';
// Test-only real-driver barrier; product paths expose no crash hook.
const [schema,boundary,wire]=process.argv.slice(2),request=JSON.parse(wire),pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1}),connect=pool.connect.bind(pool);
pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);client.query=async(...args)=>{if(args[0]==='COMMIT'&&boundary==='before-commit'){process.send({event:'boundary',boundary});await new Promise(()=>{});}const result=await query(...args);if(args[0]==='COMMIT'&&boundary==='after-commit'){process.send({event:'boundary',boundary});await new Promise(()=>{});}return result;};return client;};
try{await new PostgresPrivatePageMetadataStore(pool,schema).rename({issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner',expiresAt:Math.floor(Date.now()/1000)+300},request.workspaceId,request.pageId,request.body);process.send({event:'unexpected-completion'});process.exitCode=1;}
catch{process.send({event:'failed'});process.exitCode=1;}finally{await pool.end();process.disconnect();}
