import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {databaseSourceSchema,databaseValueSchema,parseDatabaseRecord,parseDatabaseValue,type DatabaseRecord,type DatabaseSource,type DatabaseValue} from './database.js';

const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const scope={sourceId:idSchema,schemaVersion:version,recordId:idSchema,pageId:idSchema};
const values=z.record(idSchema,databaseValueSchema);
const resolution=z.strictObject({conflictId:idSchema,propertyId:idSchema,remoteVersion:version,choice:z.enum(['local','remote'])});
export const databaseRecordIntentSchema=z.discriminatedUnion('kind',[
 z.strictObject({...scope,kind:z.literal('create'),baseVersion:z.null(),values}),
 z.strictObject({...scope,kind:z.literal('update'),baseVersion:version,values:values.refine(value=>Object.keys(value).length>0,'Empty record update'),resolution:resolution.optional()}),
]).superRefine((intent,ctx)=>{
 if(intent.kind==='update'&&intent.resolution&&(intent.baseVersion<intent.resolution.remoteVersion||Object.keys(intent.values).length!==1||!Object.hasOwn(intent.values,intent.resolution.propertyId)))ctx.addIssue({code:'custom',message:'A resolution must target exactly one field at or after its observed remote version'});
});
export type DatabaseRecordIntent=z.infer<typeof databaseRecordIntentSchema>;
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function parseDatabaseRecordIntent(source:DatabaseSource,candidate:unknown):DatabaseRecordIntent{
 const definition=databaseSourceSchema.parse(source),intent=databaseRecordIntentSchema.parse(candidate);
 if(intent.sourceId!==definition.id||intent.schemaVersion!==definition.schemaVersion)throw new Error('Database schema snapshot mismatch');
 // Validate property references and values without creating a record/version.
 parseDatabaseRecord(definition,{id:intent.recordId,workspaceId:definition.workspaceId,sourceId:definition.id,pageId:intent.pageId,version:1,values:intent.values});
 return freeze(intent);
}
const cellState=z.discriminatedUnion('present',[
 z.strictObject({present:z.literal(false),value:z.null()}),z.strictObject({present:z.literal(true),value:databaseValueSchema}),
]);
export type DatabaseCellState=z.infer<typeof cellState>;
export const databaseRecordConflictSchema=z.strictObject({
 id:idSchema,workspaceId:idSchema,...scope,propertyId:idSchema,baseVersion:version,remoteVersion:version,
 base:cellState,local:cellState,remote:cellState,resolvedBy:idSchema.nullable(),
}).refine(value=>value.baseVersion<value.remoteVersion&&value.local.present&&value.base.value!==value.remote.value&&value.local.value!==value.base.value&&value.local.value!==value.remote.value,'Invalid three-value conflict');
export type DatabaseRecordConflict=z.infer<typeof databaseRecordConflictSchema>;
export function parseDatabaseRecordConflict(source:DatabaseSource,candidate:unknown):DatabaseRecordConflict{
 const definition=databaseSourceSchema.parse(source),conflict=databaseRecordConflictSchema.parse(candidate),property=definition.properties.find(property=>property.id===conflict.propertyId);
 if(conflict.workspaceId!==definition.workspaceId||conflict.sourceId!==definition.id||conflict.schemaVersion!==definition.schemaVersion||!property||property.type==='name')throw new Error('Invalid database conflict scope or property');
 for(const state of [conflict.base,conflict.local,conflict.remote])parseDatabaseValue(property,state.value);
 return freeze(conflict);
}
function state(record:DatabaseRecord,propertyId:string):DatabaseCellState{return Object.hasOwn(record.values,propertyId)?{present:true,value:record.values[propertyId]!}:{present:false,value:null};}
function checkedResolution(source:DatabaseSource,current:DatabaseRecord,candidate:unknown){
 const conflict=parseDatabaseRecordConflict(source,candidate),remote=state(current,conflict.propertyId);
 if(conflict.resolvedBy!==null||conflict.recordId!==current.id||conflict.pageId!==current.pageId||conflict.remoteVersion>current.version||remote.present!==conflict.remote.present||remote.value!==conflict.remote.value)throw new Error('Database conflict is resolved or its remote snapshot changed');
 return conflict;
}
// The caller supplies authoritative source/history/conflict snapshots. This
// pure function neither authorizes access nor consumes an active conflict.
export function prepareDatabaseResolution(source:DatabaseSource,record:DatabaseRecord,candidate:unknown,choice:unknown):DatabaseRecordIntent{
 const current=parseDatabaseRecord(source,record),conflict=checkedResolution(source,current,candidate),selected=z.enum(['local','remote']).parse(choice);
 return parseDatabaseRecordIntent(source,{kind:'update',sourceId:source.id,schemaVersion:source.schemaVersion,recordId:current.id,pageId:current.pageId,baseVersion:current.version,values:{[conflict.propertyId]:conflict[selected].value},resolution:{conflictId:conflict.id,propertyId:conflict.propertyId,remoteVersion:conflict.remoteVersion,choice:selected}});
}
export type DatabaseFieldConflictPlan=Readonly<{propertyId:string;base:DatabaseCellState;local:DatabaseCellState;remote:DatabaseCellState}>;
export function planDatabaseRecordUpdate(source:DatabaseSource,baseRecord:DatabaseRecord,currentRecord:DatabaseRecord,candidate:unknown,activeConflict?:unknown):Readonly<{status:'unchanged'|'merged'|'conflict';currentVersion:number;proposedValues:Readonly<Record<string,DatabaseValue>>;changedPropertyIds:readonly string[];conflicts:readonly DatabaseFieldConflictPlan[]}>{
 const intent=parseDatabaseRecordIntent(source,candidate);if(intent.kind!=='update')throw new Error('Record merge requires an update');
 const base=parseDatabaseRecord(source,baseRecord),current=parseDatabaseRecord(source,currentRecord);
 if(base.id!==intent.recordId||current.id!==intent.recordId||base.pageId!==intent.pageId||current.pageId!==intent.pageId||base.version!==intent.baseVersion||base.version>current.version)throw new Error('Database record history or binding mismatch');
 if(base.version===current.version&&[...new Set([...Object.keys(base.values),...Object.keys(current.values)])].some(id=>Object.hasOwn(base.values,id)!==Object.hasOwn(current.values,id)||base.values[id]!==current.values[id]))throw new Error('A record version cannot have different snapshots');
 if(intent.resolution){
  if(intent.baseVersion!==current.version)throw new Error('A resolution requires the current record snapshot');
  const conflict=checkedResolution(source,current,activeConflict),chosen=conflict[intent.resolution.choice];
  if(conflict.id!==intent.resolution.conflictId||conflict.propertyId!==intent.resolution.propertyId||intent.values[conflict.propertyId]!==chosen.value)throw new Error('Database resolution choice mismatch');
 }else if(activeConflict!==undefined)throw new Error('Unexpected resolution snapshot');
 const proposedValues={...current.values},changedPropertyIds:string[]=[],conflicts:DatabaseFieldConflictPlan[]=[];
 for(const propertyId of Object.keys(intent.values).sort()){
  const prior=state(base,propertyId),remote=state(current,propertyId),local:DatabaseCellState={present:true,value:intent.values[propertyId]!};
  if(local.value===prior.value||local.value===remote.value)continue;
  if(remote.value!==prior.value)conflicts.push({propertyId,base:prior,local,remote});
  else{proposedValues[propertyId]=local.value;changedPropertyIds.push(propertyId);}
 }
 return freeze({status:conflicts.length?'conflict':changedPropertyIds.length?'merged':'unchanged',currentVersion:current.version,proposedValues,changedPropertyIds,conflicts});
}
