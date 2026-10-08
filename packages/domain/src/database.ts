import {z} from 'zod';
import {dateOnlySchema,idSchema} from '@greiva/shared';

const label=z.string().max(120).refine(value=>value.trim().length>0,'Missing label');
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const common={id:idSchema,name:label};
export const databasePropertySchema=z.discriminatedUnion('type',[
 z.strictObject({...common,type:z.literal('name')}),
 z.strictObject({...common,type:z.literal('text')}),
 z.strictObject({...common,type:z.literal('number')}),
 z.strictObject({...common,type:z.literal('checkbox')}),
 z.strictObject({...common,type:z.literal('date')}),
 z.strictObject({...common,type:z.literal('select'),options:z.array(z.strictObject({id:idSchema,name:label})).max(100).refine(rows=>new Set(rows.map(row=>row.id)).size===rows.length,'Duplicate option ID')}),
]);
export const databaseSourceSchema=z.strictObject({
 id:idSchema,workspaceId:idSchema,name:label,schemaVersion:version,
 properties:z.array(databasePropertySchema).min(1).max(64),
}).superRefine((source,ctx)=>{
 if(new Set(source.properties.map(row=>row.id)).size!==source.properties.length)ctx.addIssue({code:'custom',message:'Duplicate property ID'});
 if(source.properties.filter(row=>row.type==='name').length!==1)ctx.addIssue({code:'custom',message:'Exactly one Page-bound Name property is required'});
});
export type DatabaseProperty=z.infer<typeof databasePropertySchema>;
export type DatabaseSource=z.infer<typeof databaseSourceSchema>;
export type DatabaseValue=string|number|boolean|null;
const text=z.string().max(65536);
const date=dateOnlySchema.refine(value=>!value.startsWith('0000-'),'Calendar year must be at least 1');
export function parseDatabaseValue(property:DatabaseProperty,candidate:unknown):DatabaseValue{
 const definition=databasePropertySchema.parse(property);
 if(candidate===null)return null;
 switch(definition.type){
  case 'name':case 'text':return text.parse(candidate);
  case 'number':return z.number().finite().parse(candidate);
  case 'checkbox':return z.boolean().parse(candidate);
  case 'date':return date.parse(candidate);
  case 'select':{const id=idSchema.parse(candidate);if(!definition.options.some(option=>option.id===id))throw new Error('Unknown select option ID');return id;}
 }
}
const primitive=z.union([text,z.number().finite(),z.boolean(),z.null()]);
export const databaseRecordSchema=z.strictObject({id:idSchema,workspaceId:idSchema,sourceId:idSchema,pageId:idSchema,version,values:z.record(idSchema,primitive)});
export type DatabaseRecord=z.infer<typeof databaseRecordSchema>;
export function parseDatabaseRecord(source:DatabaseSource,candidate:unknown):DatabaseRecord{
 const definition=databaseSourceSchema.parse(source),record=databaseRecordSchema.parse(candidate);
 if(record.sourceId!==definition.id||record.workspaceId!==definition.workspaceId)throw new Error('Database record scope mismatch');
 const properties=new Map(definition.properties.map(property=>[property.id,property]));
 for(const [id,value] of Object.entries(record.values)){
  const property=properties.get(id);if(!property)throw new Error('Unknown database property ID');
  // Name is a projection of Page metadata. Never persist a second title here.
  if(property.type==='name')throw new Error('Name must use the bound Page title');
  record.values[id]=parseDatabaseValue(property,value);
 }
 return record;
}

const predicate=z.discriminatedUnion('operator',[
 z.strictObject({kind:z.literal('predicate'),propertyId:idSchema,operator:z.enum(['eq','not_eq','contains','lt','lte','gt','gte']),value:primitive}),
 z.strictObject({kind:z.literal('predicate'),propertyId:idSchema,operator:z.enum(['is_unset','is_set'])}),
]);
// Explicit finite schema avoids recursive parsing of an unbounded filter tree.
const group1=z.strictObject({kind:z.enum(['and','or']),children:z.array(predicate).min(1).max(20)});
const group2=z.strictObject({kind:z.enum(['and','or']),children:z.array(z.union([predicate,group1])).min(1).max(20)});
const group3=z.strictObject({kind:z.enum(['and','or']),children:z.array(z.union([predicate,group2])).min(1).max(20)});
export const databaseFilterSchema=z.union([predicate,group3]);
export type DatabaseFilter=z.infer<typeof databaseFilterSchema>;
export const databaseViewSchema=z.strictObject({
 id:idSchema,sourceId:idSchema,layout:z.enum(['table','list']),name:label,
 visiblePropertyIds:z.array(idSchema).min(1).max(64),filter:databaseFilterSchema.nullable(),
 sorts:z.array(z.strictObject({propertyId:idSchema,direction:z.enum(['asc','desc'])})).max(8),
});
export type DatabaseView=z.infer<typeof databaseViewSchema>;
export function parseDatabaseView(source:DatabaseSource,candidate:unknown):DatabaseView{
 const definition=databaseSourceSchema.parse(source),view=databaseViewSchema.parse(candidate);
 if(view.sourceId!==definition.id)throw new Error('Database view scope mismatch');
 const properties=new Map(definition.properties.map(property=>[property.id,property]));
 if(new Set(view.visiblePropertyIds).size!==view.visiblePropertyIds.length||view.visiblePropertyIds.some(id=>!properties.has(id)))throw new Error('Invalid visible property references');
 if(!view.visiblePropertyIds.includes(definition.properties.find(property=>property.type==='name')!.id))throw new Error('Name must remain visible');
 if(new Set(view.sorts.map(sort=>sort.propertyId)).size!==view.sorts.length||view.sorts.some(sort=>!properties.has(sort.propertyId)))throw new Error('Invalid sort property references');
 let predicates=0;
 function visit(node:DatabaseFilter):void{
  if(node.kind!=='predicate'){for(const child of node.children)visit(child);return;}
  if(++predicates>100)throw new Error('Too many filter predicates');
  const property=properties.get(node.propertyId);if(!property)throw new Error('Unknown filter property ID');
  if(!('value' in node))return;
  if(node.operator==='contains'){
   if(!['name','text'].includes(property.type)||typeof node.value!=='string')throw new Error('Contains requires a text value');
  }else if(['lt','lte','gt','gte'].includes(node.operator)){
   if(!['number','date'].includes(property.type)||node.value===null)throw new Error('Range comparison requires a number or date value');
   parseDatabaseValue(property,node.value);
  }else parseDatabaseValue(property,node.value);
 }
 if(view.filter)visit(view.filter);return view;
}
