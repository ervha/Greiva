import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {databaseSourceSchema,databaseViewSchema,parseDatabaseView,type DatabaseSource,type DatabaseView} from './database.js';
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const databaseViewFieldSchema=z.enum(['name','layout','visiblePropertyIds','filter','sorts']);
export type DatabaseViewField=z.infer<typeof databaseViewFieldSchema>;
export type DatabaseViewFieldValue=DatabaseView[DatabaseViewField];
const settings=databaseViewSchema.omit({id:true,sourceId:true});
const patch=settings.partial().refine(value=>Object.keys(value).length>0&&Object.values(value).every(item=>item!==undefined),'Empty or undefined view patch');
const scope={sourceId:idSchema,schemaVersion:version,viewId:idSchema};
const resolution=z.strictObject({conflictId:idSchema,field:databaseViewFieldSchema,remoteVersion:version,choice:z.enum(['local','remote'])});
export const databaseViewIntentSchema=z.discriminatedUnion('kind',[
 z.strictObject({...scope,kind:z.literal('create'),baseVersion:z.null(),settings}),
 z.strictObject({...scope,kind:z.literal('update'),baseVersion:version,patch,resolution:resolution.optional()}),
]).superRefine((intent,ctx)=>{if(intent.kind==='update'&&intent.resolution&&(intent.baseVersion<intent.resolution.remoteVersion||Object.keys(intent.patch).length!==1||!Object.hasOwn(intent.patch,intent.resolution.field)))ctx.addIssue({code:'custom',message:'Resolution requires exactly its observed field'});});
export type DatabaseViewIntent=z.infer<typeof databaseViewIntentSchema>;
export const databaseViewSnapshotSchema=z.strictObject({view:databaseViewSchema,version});
export type DatabaseViewSnapshot=z.infer<typeof databaseViewSnapshotSchema>;
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)]));return value;}
function same(a:unknown,b:unknown){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
function fieldValue(source:DatabaseSource,viewId:string,field:DatabaseViewField,value:unknown):DatabaseViewFieldValue{
 // Validation scaffold only. Never becomes a saved View or a replacement base.
 const name=source.properties.find(property=>property.type==='name')!.id;
 return parseDatabaseView(source,{id:viewId,sourceId:source.id,name:'Field validation',layout:'table',visiblePropertyIds:[name],filter:null,sorts:[],[field]:value})[field];
}
export function parseDatabaseViewSnapshot(source:DatabaseSource,candidate:unknown):DatabaseViewSnapshot{const snapshot=databaseViewSnapshotSchema.parse(candidate);return freeze({view:parseDatabaseView(source,snapshot.view),version:snapshot.version});}
export function parseDatabaseViewIntent(source:DatabaseSource,candidate:unknown):DatabaseViewIntent{
 const definition=databaseSourceSchema.parse(source),intent=databaseViewIntentSchema.parse(candidate);
 if(intent.sourceId!==definition.id||intent.schemaVersion!==definition.schemaVersion)throw Error('View schema snapshot mismatch');
 if(intent.kind==='create')parseDatabaseView(definition,{id:intent.viewId,sourceId:definition.id,...intent.settings});
 else for(const [key,value] of Object.entries(intent.patch))fieldValue(definition,intent.viewId,databaseViewFieldSchema.parse(key),value);
 return freeze(intent);
}
const value=z.union([settings.shape.name,settings.shape.layout,settings.shape.visiblePropertyIds,settings.shape.filter,settings.shape.sorts]);
export const databaseViewConflictSchema=z.strictObject({id:idSchema,workspaceId:idSchema,...scope,field:databaseViewFieldSchema,baseVersion:version,remoteVersion:version,base:value,local:value,remote:value,resolvedBy:idSchema.nullable()}).refine(item=>item.baseVersion<item.remoteVersion&&!same(item.base,item.local)&&!same(item.base,item.remote)&&!same(item.local,item.remote),'Invalid View triad');
export type DatabaseViewConflict=z.infer<typeof databaseViewConflictSchema>;
export function parseDatabaseViewConflict(source:DatabaseSource,candidate:unknown):DatabaseViewConflict{
 const definition=databaseSourceSchema.parse(source),conflict=databaseViewConflictSchema.parse(candidate);
 if(conflict.workspaceId!==definition.workspaceId||conflict.sourceId!==definition.id||conflict.schemaVersion!==definition.schemaVersion)throw Error('Invalid View conflict scope');
 for(const item of [conflict.base,conflict.local,conflict.remote])fieldValue(definition,conflict.viewId,conflict.field,item);
 return freeze(conflict);
}
function active(source:DatabaseSource,current:DatabaseViewSnapshot,candidate:unknown){
 const conflict=parseDatabaseViewConflict(source,candidate);
 if(conflict.resolvedBy!==null||conflict.viewId!==current.view.id||conflict.remoteVersion>current.version||!same(conflict.remote,current.view[conflict.field]))throw Error('View conflict resolved or remote field changed');
 return conflict;
}
export function prepareDatabaseViewResolution(source:DatabaseSource,snapshot:DatabaseViewSnapshot,candidate:unknown,choice:unknown):DatabaseViewIntent{
 const current=parseDatabaseViewSnapshot(source,snapshot),conflict=active(source,current,candidate),selected=z.enum(['local','remote']).parse(choice);
 return parseDatabaseViewIntent(source,{kind:'update',sourceId:source.id,schemaVersion:source.schemaVersion,viewId:current.view.id,baseVersion:current.version,patch:{[conflict.field]:conflict[selected]},resolution:{conflictId:conflict.id,field:conflict.field,remoteVersion:conflict.remoteVersion,choice:selected}});
}
export type DatabaseViewFieldConflictPlan=Readonly<{field:DatabaseViewField;base:DatabaseViewFieldValue;local:DatabaseViewFieldValue;remote:DatabaseViewFieldValue}>;
export function planDatabaseViewUpdate(source:DatabaseSource,baseSnapshot:DatabaseViewSnapshot,currentSnapshot:DatabaseViewSnapshot,candidate:unknown,activeConflict?:unknown):Readonly<{status:'unchanged'|'merged'|'conflict';currentVersion:number;proposedView:DatabaseView;changedFields:readonly DatabaseViewField[];conflicts:readonly DatabaseViewFieldConflictPlan[]}>{
 const intent=parseDatabaseViewIntent(source,candidate);if(intent.kind!=='update')throw Error('View update required');
 const base=parseDatabaseViewSnapshot(source,baseSnapshot),current=parseDatabaseViewSnapshot(source,currentSnapshot);
 if(base.view.id!==intent.viewId||current.view.id!==intent.viewId||base.version!==intent.baseVersion||base.version>current.version||(base.version===current.version&&!same(base.view,current.view)))throw Error('View history or binding mismatch');
 if(intent.resolution){const conflict=active(source,current,activeConflict);if(intent.baseVersion!==current.version||conflict.id!==intent.resolution.conflictId||conflict.field!==intent.resolution.field||conflict.remoteVersion!==intent.resolution.remoteVersion||!same(intent.patch[conflict.field],conflict[intent.resolution.choice]))throw Error('View resolution snapshot mismatch');}else if(activeConflict!==undefined)throw Error('Unexpected View conflict');
 const proposed={...current.view},changedFields:DatabaseViewField[]=[],conflicts:DatabaseViewFieldConflictPlan[]=[];
 for(const key of Object.keys(intent.patch).sort()){
  const field=databaseViewFieldSchema.parse(key),local=fieldValue(source,intent.viewId,field,intent.patch[field]),prior=base.view[field],remote=current.view[field];
  if(same(local,prior)||same(local,remote))continue;
  if(!same(remote,prior))conflicts.push({field,base:prior,local,remote});else{Object.assign(proposed,{[field]:local});changedFields.push(field);}
 }
 return freeze({status:conflicts.length?'conflict':changedFields.length?'merged':'unchanged',currentVersion:current.version,proposedView:parseDatabaseView(source,proposed),changedFields,conflicts});
}
