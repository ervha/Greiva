import {z} from 'zod';
import {databaseRecordSchema,databaseSourceSchema,parseDatabaseRecord,parseDatabaseView,type DatabaseFilter,type DatabaseProperty,type DatabaseRecord,type DatabaseSource,type DatabaseValue} from './database.js';

const rowSchema=z.strictObject({record:databaseRecordSchema,pageTitle:z.string().max(65536)});
export type DatabaseRow=Readonly<{record:DatabaseRecord;pageTitle:string}>;
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function comparePrimitive(a:string|number|boolean,b:string|number|boolean):number{
 if(a===b)return 0;
 if(typeof a==='number'&&typeof b==='number')return a<b?-1:1;
 if(typeof a==='boolean'&&typeof b==='boolean')return a?1:-1;
 return String(a)<String(b)?-1:1;
}
function cell(row:DatabaseRow,property:DatabaseProperty):DatabaseValue{return property.type==='name'?row.pageTitle:row.record.values[property.id]??null;}
function compare(a:DatabaseValue,b:DatabaseValue,property:DatabaseProperty):number{
 if(a===null)return b===null?0:1;if(b===null)return -1;
 if(property.type==='select')return comparePrimitive(property.options.findIndex(option=>option.id===a),property.options.findIndex(option=>option.id===b));
 return comparePrimitive(a,b);
}
function matches(row:DatabaseRow,filter:DatabaseFilter,properties:Map<string,DatabaseProperty>):boolean{
 if(filter.kind!=='predicate')return filter.kind==='and'?filter.children.every(child=>matches(row,child,properties)):filter.children.some(child=>matches(row,child,properties));
 const property=properties.get(filter.propertyId)!,value=cell(row,property);
 switch(filter.operator){
  case 'is_unset':return value===null;
  case 'is_set':return value!==null;
  case 'eq':return value===filter.value;
  case 'not_eq':return value!==filter.value;
  case 'contains':return typeof value==='string'&&value.includes(filter.value as string);
  case 'lt':return value!==null&&compare(value,filter.value,property)<0;
  case 'lte':return value!==null&&compare(value,filter.value,property)<=0;
  case 'gt':return value!==null&&compare(value,filter.value,property)>0;
  case 'gte':return value!==null&&compare(value,filter.value,property)>=0;
 }
}
// A pure query of at most 1000 supplied, authorized local rows. No fetch/store
// port and no claim of a complete source or server-side search is made here.
export function queryDatabaseView(source:DatabaseSource,candidate:unknown,candidates:unknown):Readonly<{scope:'loaded-window';rows:readonly DatabaseRow[]}>{
 const definition=databaseSourceSchema.parse(source),view=parseDatabaseView(definition,candidate),rows=z.array(rowSchema).max(1000).parse(candidates).map(row=>({...row,record:parseDatabaseRecord(definition,row.record)}));
 if(new Set(rows.map(row=>row.record.id)).size!==rows.length||new Set(rows.map(row=>row.record.pageId)).size!==rows.length)throw new Error('Duplicate record or Page binding in query window');
 const properties=new Map(definition.properties.map(property=>[property.id,property]));
 const result=rows.filter(row=>!view.filter||matches(row,view.filter,properties)).sort((a,b)=>{
  for(const sort of view.sorts){const property=properties.get(sort.propertyId)!,left=cell(a,property),right=cell(b,property),ordered=compare(left,right,property);if(ordered)return left===null||right===null?ordered:sort.direction==='asc'?ordered:-ordered;}
  return comparePrimitive(a.record.id,b.record.id);
 });
 return freeze({scope:'loaded-window' as const,rows:result});
}

const loadedRowSchema=z.strictObject({record:databaseRecordSchema,pageTitle:z.string().max(65536).nullable()});
export type LoadedDatabaseRow=Readonly<{record:DatabaseRecord;pageTitle:string|null}>;
export type LoadedDatabaseQuery=Readonly<{
 scope:'loaded-window';rows:readonly LoadedDatabaseRow[];
 unresolved:readonly Readonly<{row:LoadedDatabaseRow;reason:'filter'|'sort'}>[];
}>;
// Unknown Page metadata is separate from an actually empty title. AND/OR can
// still decide a row when another predicate settles the outcome.
function matchesLoaded(row:LoadedDatabaseRow,filter:DatabaseFilter,properties:Map<string,DatabaseProperty>):boolean|null{
 if(filter.kind==='predicate'){
  if(properties.get(filter.propertyId)!.type==='name'&&row.pageTitle===null)return null;
  return matches(row as DatabaseRow,filter,properties);
 }
 const values=filter.children.map(child=>matchesLoaded(row,child,properties));
 if(filter.kind==='and')return values.includes(false)?false:values.includes(null)?null:true;
 return values.includes(true)?true:values.includes(null)?null:false;
}
export function queryLoadedDatabaseView(source:DatabaseSource,candidate:unknown,candidates:unknown):LoadedDatabaseQuery{
 const definition=databaseSourceSchema.parse(source),view=parseDatabaseView(definition,candidate);
 const rows=z.array(loadedRowSchema).max(1000).parse(candidates).map(row=>({...row,record:parseDatabaseRecord(definition,row.record)}));
 if(new Set(rows.map(row=>row.record.id)).size!==rows.length||new Set(rows.map(row=>row.record.pageId)).size!==rows.length)throw new Error('Duplicate record or Page binding in query window');
 const properties=new Map(definition.properties.map(property=>[property.id,property]));
 const nameSort=view.sorts.some(sort=>properties.get(sort.propertyId)!.type==='name');
 const included:LoadedDatabaseRow[]=[],unresolved:{row:LoadedDatabaseRow;reason:'filter'|'sort'}[]=[];
 for(const row of rows){
  const match=view.filter?matchesLoaded(row,view.filter,properties):true;
  if(match===false)continue;
  if(match===null){unresolved.push({row,reason:'filter'});continue;}
  if(nameSort&&row.pageTitle===null){unresolved.push({row,reason:'sort'});continue;}
  included.push(row);
 }
 included.sort((a,b)=>{
  for(const sort of view.sorts){
   const property=properties.get(sort.propertyId)!,left=cell(a as DatabaseRow,property),right=cell(b as DatabaseRow,property),ordered=compare(left,right,property);
   if(ordered)return left===null||right===null?ordered:sort.direction==='asc'?ordered:-ordered;
  }
  return comparePrimitive(a.record.id,b.record.id);
 });
 unresolved.sort((a,b)=>comparePrimitive(a.row.record.id,b.row.record.id));
 return freeze({scope:'loaded-window' as const,rows:included,unresolved});
}
