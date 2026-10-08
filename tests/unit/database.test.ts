import {it,expect} from 'vitest';
import {newId} from '@greiva/shared';
import {databaseSourceSchema,parseDatabaseValue,parseDatabaseRecord,parseDatabaseView,queryDatabaseView,type DatabaseSource,type DatabaseRow} from '@greiva/domain';
function fixture(){
 const ids={name:newId(),text:newId(),number:newId(),checkbox:newId(),select:newId(),date:newId()},options=[{id:newId(),name:'Z'},{id:newId(),name:'A'}];
 const source=databaseSourceSchema.parse({id:newId(),workspaceId:newId(),name:'Source',schemaVersion:1,properties:Object.entries(ids).map(([type,id])=>({id,type,name:type,...(type==='select'?{options}:{})}))});
 const view={id:newId(),sourceId:source.id,layout:'table',name:'Table',visiblePropertyIds:Object.values(ids),filter:null,sorts:[]};
 const row=(values:Record<string,string|number|boolean|null>={},pageTitle='Page'):DatabaseRow=>({record:parseDatabaseRecord(source,{id:newId(),workspaceId:source.workspaceId,sourceId:source.id,pageId:newId(),version:1,values}),pageTitle});
 const predicate=(type:keyof typeof ids,operator:string,value?:string|number|boolean|null)=>({kind:'predicate',propertyId:ids[type],operator,...(value===undefined?{}:{value})});
 return{ids,options,source,view,row,predicate};
}
it('DB-SOURCE: exactly one stable Name, unique definitions/options and supported subset are required',()=>{
 const f=fixture();expect(f.source.properties).toHaveLength(6);
 for(const properties of [f.source.properties.slice(1),[...f.source.properties,{id:newId(),name:'second',type:'name'}],[...f.source.properties,f.source.properties[1]],f.source.properties.map(row=>row.type==='select'?{...row,options:[...row.options,row.options[0]]}:row),[...f.source.properties,{id:newId(),name:'future',type:'formula'}]])expect(()=>databaseSourceSchema.parse({...f.source,properties})).toThrow();
 expect(()=>databaseSourceSchema.parse({...f.source,schemaVersion:Number.MAX_SAFE_INTEGER+1})).toThrow();
});
it('DB-VALUES: zero, false, blank, null and omitted values retain their distinct saved representations',()=>{
 const f=fixture(),values={[f.ids.number]:0,[f.ids.checkbox]:false,[f.ids.text]:'',[f.ids.date]:null},record=f.row(values).record;
 expect(record.values).toEqual(values);expect(Object.hasOwn(record.values,f.ids.select)).toBe(false);
});
it('DB-VALUES: strict primitives reject coercion, non-finite numbers, invalid dates and unknown select options',()=>{
 const f=fixture(),invalid={name:[2,false],text:[3,{}],number:['1',true,NaN,Infinity],checkbox:['false',0],select:[newId(),'Z'],date:['2027-02-29','0000-01-01','2028-02-29T09:00:00Z',1]};
 for(const property of f.source.properties){for(const value of invalid[property.type])expect(()=>parseDatabaseValue(property,value)).toThrow();expect(parseDatabaseValue(property,null)).toBeNull();}
 expect(parseDatabaseValue(f.source.properties.find(row=>row.type==='date')!,'2028-02-29')).toBe('2028-02-29');
});
it('DB-RECORD: Page-bound Name, unknown properties and cross-source/workspace writes are rejected',()=>{
 const f=fixture(),record=f.row().record;
 for(const candidate of [{...record,workspaceId:newId()},{...record,sourceId:newId()},{...record,values:{[f.ids.name]:'duplicate title'}},{...record,values:{[newId()]:'unknown'}},{...record,values:{[f.ids.number]:'coerced'}},{...record,pageId:'unverified'}])expect(()=>parseDatabaseRecord(f.source,candidate)).toThrow();
});
it('DB-QUERY: parsing snapshots clones caller input and deeply freezes results without mutating records/views',()=>{
 const f=fixture(),row=f.row({[f.ids.text]:'retained'}),before=JSON.stringify({row,view:f.view,source:f.source}),result=queryDatabaseView(f.source,f.view,[row]);
 expect(result.scope).toBe('loaded-window');expect(JSON.stringify({row,view:f.view,source:f.source})).toBe(before);expect(result.rows[0]).not.toBe(row);expect(Object.isFrozen(result.rows[0]!.record.values)).toBe(true);row.record.values[f.ids.text]='changed later';expect(result.rows[0]!.record.values[f.ids.text]).toBe('retained');
});
it('DB-VIEW: property references are stable and invalid/duplicate/hidden Name or foreign source are rejected',()=>{
 const f=fixture();for(const candidate of [{...f.view,sourceId:newId()},{...f.view,visiblePropertyIds:[f.ids.text]},{...f.view,visiblePropertyIds:[f.ids.name,f.ids.name]},{...f.view,visiblePropertyIds:[f.ids.name,newId()]},{...f.view,sorts:[{propertyId:newId(),direction:'asc'}]},{...f.view,sorts:[{propertyId:f.ids.name,direction:'asc'},{propertyId:f.ids.name,direction:'desc'}]},{...f.view,layout:'calendar'}])expect(()=>parseDatabaseView(f.source,candidate)).toThrow();
});
it('DB-FILTER: operators validate against property type and exact option references before query',()=>{
 const f=fixture();for(const filter of [f.predicate('checkbox','contains','false'),f.predicate('text','gt','a'),f.predicate('number','lt','1'),f.predicate('date','eq','2027-02-29'),f.predicate('select','eq',newId()),f.predicate('number','gt',null),{...f.predicate('text','eq','a'),propertyId:newId()},{...f.predicate('text','is_unset'),value:null}])expect(()=>parseDatabaseView(f.source,{...f.view,filter})).toThrow();
 expect(parseDatabaseView(f.source,{...f.view,filter:f.predicate('number','eq',null)}).filter).toBeTruthy();
});
it('DB-FILTER: finite three-level AND/OR nesting and total predicate bound reject oversized trees',()=>{
 const f=fixture(),leaf=f.predicate('number','eq',0),group=(child:unknown)=>({kind:'and',children:[child]});
 expect(()=>parseDatabaseView(f.source,{...f.view,filter:group(group(group(leaf)))})).not.toThrow();expect(()=>parseDatabaseView(f.source,{...f.view,filter:group(group(group(group(leaf))))})).toThrow();
 expect(()=>parseDatabaseView(f.source,{...f.view,filter:{kind:'or',children:Array.from({length:11},()=>({kind:'and',children:Array.from({length:10},()=>leaf)}))}})).toThrow();
});
it('DB-FILTER: unset excludes false/zero/blank and null compares consistently without erasing values',()=>{
 const f=fixture(),zero=f.row({[f.ids.number]:0,[f.ids.checkbox]:false,[f.ids.text]:''}),unset=f.row({[f.ids.number]:null}),omitted=f.row(),rows=[zero,unset,omitted];
 const ids=(filter:unknown)=>queryDatabaseView(f.source,{...f.view,filter},rows).rows.map(row=>row.record.id);
 expect(ids(f.predicate('number','eq',0))).toEqual([zero.record.id]);expect(ids(f.predicate('checkbox','eq',false))).toEqual([zero.record.id]);expect(ids(f.predicate('text','eq',''))).toEqual([zero.record.id]);expect(ids(f.predicate('text','is_set'))).toEqual([zero.record.id]);expect(ids(f.predicate('number','is_unset'))).toEqual([unset.record.id,omitted.record.id].sort());expect(ids(f.predicate('number','eq',null))).toEqual([unset.record.id,omitted.record.id].sort());
});
it('DB-VIEWS: Table/List read the same records and their independent sort/filter does not duplicate or rewrite data',()=>{
 const f=fixture(),a=f.row({[f.ids.number]:2},'Alpha'),b=f.row({[f.ids.number]:1},'Beta'),rows=[a,b],before=JSON.stringify(rows);
 const table=queryDatabaseView(f.source,{...f.view,sorts:[{propertyId:f.ids.number,direction:'asc'}]},rows),list=queryDatabaseView(f.source,{...f.view,id:newId(),layout:'list',filter:f.predicate('name','contains','Alpha')},rows);
 expect(table.rows.map(row=>row.record.id)).toEqual([b.record.id,a.record.id]);expect(list.rows.map(row=>row.record.id)).toEqual([a.record.id]);expect(JSON.stringify(rows)).toBe(before);
});
it('DB-SORT: multi-column sort keeps nulls last in both directions and uses record ID for deterministic ties',()=>{
 const f=fixture(),a=f.row({[f.ids.number]:2,[f.ids.checkbox]:true}),b=f.row({[f.ids.number]:2,[f.ids.checkbox]:false}),c=f.row({[f.ids.number]:1}),d=f.row(),e=f.row({[f.ids.number]:2,[f.ids.checkbox]:false}),rows=[e,d,c,b,a];
 const ties=[b.record.id,e.record.id].sort();expect(queryDatabaseView(f.source,{...f.view,sorts:[{propertyId:f.ids.number,direction:'desc'},{propertyId:f.ids.checkbox,direction:'asc'}]},rows).rows.map(row=>row.record.id)).toEqual([...ties,a.record.id,c.record.id,d.record.id]);expect(queryDatabaseView(f.source,{...f.view,sorts:[{propertyId:f.ids.number,direction:'asc'}]},rows).rows.at(-1)!.record.id).toBe(d.record.id);
});
it('DB-SELECT: option/property renaming preserves values, references and option-order sorting',()=>{
 const f=fixture(),a=f.row({[f.ids.select]:f.options[0]!.id}),b=f.row({[f.ids.select]:f.options[1]!.id}),source:DatabaseSource={...f.source,properties:f.source.properties.map(row=>row.type==='select'?{...row,name:'renamed',options:row.options.map(option=>({...option,name:'same displayed name'}))}:row)},view={...f.view,sorts:[{propertyId:f.ids.select,direction:'asc'}]};
 expect(queryDatabaseView(source,view,[b,a]).rows.map(row=>row.record.id)).toEqual([a.record.id,b.record.id]);expect(parseDatabaseRecord(source,a.record).values[f.ids.select]).toBe(f.options[0]!.id);
});
it('DB-DATE: canonical date-only range filters and ordering do not convert to UTC or Task due',()=>{
 const f=fixture(),a=f.row({[f.ids.date]:'2028-02-29'}),b=f.row({[f.ids.date]:'2028-03-01'}),c=f.row();const result=queryDatabaseView(f.source,{...f.view,filter:{kind:'and',children:[f.predicate('date','gte','2028-02-29'),f.predicate('date','lt','2028-03-01')]},sorts:[{propertyId:f.ids.date,direction:'asc'}]},[b,c,a]);expect(result.rows.map(row=>row.record.id)).toEqual([a.record.id]);expect(result.rows[0]!.record.values[f.ids.date]).toBe('2028-02-29');
});
it('DB-QUERY: bounded authorized input rejects duplicate IDs/Page bindings, other scope and over 1000 rows',()=>{
 const f=fixture(),a=f.row();for(const rows of [[a,a],[a,{...f.row(),record:{...a.record,id:newId()}}],[{...a,record:{...a.record,workspaceId:newId()}}],Array.from({length:1001},()=>a)])expect(()=>queryDatabaseView(f.source,f.view,rows)).toThrow();
});
it('DB-NAME: empty bound Page title is a set string and an unavailable title is not silently projected as blank',()=>{
 const f=fixture(),row=f.row({},'');expect(queryDatabaseView(f.source,{...f.view,filter:f.predicate('name','eq','')},[row]).rows).toHaveLength(1);expect(queryDatabaseView(f.source,{...f.view,filter:f.predicate('name','is_unset')},[row]).rows).toHaveLength(0);expect(()=>queryDatabaseView(f.source,f.view,[{...row,pageTitle:null}])).toThrow();
});
