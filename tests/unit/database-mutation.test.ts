import {it,expect} from 'vitest';
import {newId} from '@greiva/shared';
import {databaseSourceSchema,parseDatabaseRecord,parseDatabaseRecordIntent,parseDatabaseRecordConflict,planDatabaseRecordUpdate,prepareDatabaseResolution,type DatabaseRecord,type DatabaseRecordConflict} from '@greiva/domain';
function fixture(){
 const ids={name:newId(),text:newId(),number:newId(),checkbox:newId()},source=databaseSourceSchema.parse({id:newId(),workspaceId:newId(),name:'Source',schemaVersion:1,properties:Object.entries(ids).map(([type,id])=>({id,type,name:type}))});
 const base=parseDatabaseRecord(source,{id:newId(),workspaceId:source.workspaceId,sourceId:source.id,pageId:newId(),version:1,values:{[ids.text]:'base',[ids.number]:0,[ids.checkbox]:false}});
 const current=(values:DatabaseRecord['values'],version=2):DatabaseRecord=>({...base,version,values:{...base.values,...values}});
 const update=(values:DatabaseRecord['values'],baseVersion=1)=>({kind:'update',sourceId:source.id,schemaVersion:source.schemaVersion,recordId:base.id,pageId:base.pageId,baseVersion,values});
 const remote=current({[ids.text]:'remote'}),intent=update({[ids.text]:'local'}),plan=planDatabaseRecordUpdate(source,base,remote,intent);
 const conflict:DatabaseRecordConflict={id:newId(),workspaceId:source.workspaceId,sourceId:source.id,schemaVersion:1,recordId:base.id,pageId:base.pageId,baseVersion:1,remoteVersion:2,...plan.conflicts[0]!,resolvedBy:null};
 return{ids,source,base,current,update,remote,intent,conflict};
}
it('DB-INTENT: create validates bound Page values and freezes a clone without assigning canonical versions',()=>{
 const f=fixture(),candidate={kind:'create',sourceId:f.source.id,schemaVersion:1,recordId:newId(),pageId:newId(),baseVersion:null,values:{[f.ids.number]:0}},intent=parseDatabaseRecordIntent(f.source,candidate);
 candidate.values[f.ids.number]=9;expect(intent.values[f.ids.number]).toBe(0);expect(Object.isFrozen(intent.values)).toBe(true);expect(intent).not.toHaveProperty('version');expect(intent).not.toHaveProperty('operationId');
});
it('DB-INTENT: update rejects empty patches, Name copies, unknown properties, coerced values and stale schema',()=>{
 const f=fixture();for(const candidate of [f.update({}),f.update({[f.ids.name]:'duplicate'}),f.update({[newId()]:'unknown'}),f.update({[f.ids.number]:'1'}),{...f.intent,schemaVersion:2},{...f.intent,sourceId:newId()},{...f.intent,baseVersion:null}])expect(()=>parseDatabaseRecordIntent(f.source,candidate)).toThrow();
});
it('DB-MERGE: separate property edits merge while preserving every unrelated remote value',()=>{
 const f=fixture(),remote=f.current({[f.ids.text]:'remote'}),plan=planDatabaseRecordUpdate(f.source,f.base,remote,f.update({[f.ids.number]:2}));
 expect(plan).toMatchObject({status:'merged',currentVersion:2,changedPropertyIds:[f.ids.number],conflicts:[],proposedValues:{[f.ids.text]:'remote',[f.ids.number]:2,[f.ids.checkbox]:false}});expect(remote.values[f.ids.number]).toBe(0);
});
it('DB-MERGE: same-field divergent changes retain base/local/remote and propose only non-conflicting fields',()=>{
 const f=fixture(),intent=f.update({[f.ids.text]:'local',[f.ids.number]:2}),before=JSON.stringify({base:f.base,remote:f.remote,intent}),plan=planDatabaseRecordUpdate(f.source,f.base,f.remote,intent);
 expect(plan.status).toBe('conflict');expect(plan.proposedValues[f.ids.text]).toBe('remote');expect(plan.proposedValues[f.ids.number]).toBe(2);expect(plan.conflicts).toEqual([{propertyId:f.ids.text,base:{present:true,value:'base'},local:{present:true,value:'local'},remote:{present:true,value:'remote'}}]);expect(JSON.stringify({base:f.base,remote:f.remote,intent})).toBe(before);expect(Object.isFrozen(plan.conflicts[0]!.local)).toBe(true);
});
it('DB-MERGE: unchanged local input never overwrites a newer remote field',()=>{
 const f=fixture(),plan=planDatabaseRecordUpdate(f.source,f.base,f.remote,f.update({[f.ids.text]:'base'}));expect(plan).toMatchObject({status:'unchanged',conflicts:[],changedPropertyIds:[],proposedValues:{[f.ids.text]:'remote'}});
});
it('DB-MERGE: equal concurrent values converge without a false conflict or another proposed write',()=>{
 const f=fixture(),plan=planDatabaseRecordUpdate(f.source,f.base,f.remote,f.update({[f.ids.text]:'remote'}));expect(plan).toMatchObject({status:'unchanged',conflicts:[],changedPropertyIds:[]});
});
it('DB-MERGE: false/zero/blank and explicit unset survive patches without coercion',()=>{
 const f=fixture(),plan=planDatabaseRecordUpdate(f.source,f.base,f.base,f.update({[f.ids.text]:'',[f.ids.number]:null,[f.ids.checkbox]:false}));expect(plan.proposedValues).toEqual({[f.ids.text]:'',[f.ids.number]:null,[f.ids.checkbox]:false});expect(plan.conflicts).toEqual([]);
});
it('DB-MERGE: missing base state is retained in a conflict instead of being fabricated as a saved null',()=>{
 const f=fixture(),base={...f.base,values:{}},remote={...base,version:2,values:{[f.ids.number]:1}},plan=planDatabaseRecordUpdate(f.source,base,remote,f.update({[f.ids.number]:2}));expect(plan.conflicts[0]).toMatchObject({base:{present:false,value:null},local:{present:true,value:2},remote:{present:true,value:1}});expect(base.values).toEqual({});
});
it('DB-MERGE: history with equal versions but unequal snapshots and reversed versions is rejected',()=>{
 const f=fixture();expect(()=>planDatabaseRecordUpdate(f.source,f.base,f.current({[f.ids.number]:2},1),f.intent)).toThrow();expect(()=>planDatabaseRecordUpdate(f.source,{...f.base,version:3},f.remote,f.update({[f.ids.number]:2},3))).toThrow();expect(()=>planDatabaseRecordUpdate(f.source,f.base,{...f.base,values:{...f.base.values,[newId()]:null}},f.intent)).toThrow();
});
it('DB-MERGE: mismatched record/Page/scope/baseline never creates a partial proposal',()=>{
 const f=fixture();for(const remote of [{...f.remote,id:newId()},{...f.remote,pageId:newId()},{...f.remote,workspaceId:newId()}])expect(()=>planDatabaseRecordUpdate(f.source,f.base,remote,f.intent)).toThrow();expect(()=>planDatabaseRecordUpdate(f.source,f.base,f.remote,f.update({[f.ids.number]:2},2))).toThrow();
});
it('DB-RESOLUTION: choosing local creates a fresh intent at current version and preserves conflict history',()=>{
 const f=fixture(),before=JSON.stringify(f.conflict),intent=prepareDatabaseResolution(f.source,f.remote,f.conflict,'local');expect(intent).toMatchObject({kind:'update',baseVersion:2,values:{[f.ids.text]:'local'},resolution:{conflictId:f.conflict.id,choice:'local',remoteVersion:2}});const plan=planDatabaseRecordUpdate(f.source,f.remote,f.remote,intent,f.conflict);expect(plan).toMatchObject({status:'merged',proposedValues:{[f.ids.text]:'local'},conflicts:[]});expect(JSON.stringify(f.conflict)).toBe(before);expect(f.conflict.resolvedBy).toBeNull();
});
it('DB-RESOLUTION: choosing remote is a no-change intent and still carries the explicit resolution',()=>{
 const f=fixture(),intent=prepareDatabaseResolution(f.source,f.remote,f.conflict,'remote');expect(intent).toHaveProperty('resolution.choice','remote');expect(planDatabaseRecordUpdate(f.source,f.remote,f.remote,intent,f.conflict).status).toBe('unchanged');
});
it('DB-RESOLUTION: resolved, changed, cross-binding and stale schema candidates are rejected',()=>{
 const f=fixture();for(const conflict of [{...f.conflict,resolvedBy:newId()},{...f.conflict,recordId:newId()},{...f.conflict,pageId:newId()},{...f.conflict,schemaVersion:2},{...f.conflict,workspaceId:newId()}])expect(()=>prepareDatabaseResolution(f.source,f.remote,conflict,'local')).toThrow();expect(()=>prepareDatabaseResolution(f.source,f.current({[f.ids.text]:'different'},3),f.conflict,'local')).toThrow();expect(()=>prepareDatabaseResolution(f.source,f.remote,f.conflict,'other')).toThrow();
});
it('DB-RESOLUTION: active snapshot, exact candidate ID/property and chosen value are mandatory',()=>{
 const f=fixture(),intent=prepareDatabaseResolution(f.source,f.remote,f.conflict,'local');expect(()=>planDatabaseRecordUpdate(f.source,f.remote,f.remote,intent)).toThrow();expect(()=>planDatabaseRecordUpdate(f.source,f.remote,f.remote,{...intent,values:{[f.ids.text]:'tampered'}},f.conflict)).toThrow();expect(()=>planDatabaseRecordUpdate(f.source,f.remote,f.remote,intent,{...f.conflict,id:newId()})).toThrow();expect(()=>planDatabaseRecordUpdate(f.source,f.base,f.remote,f.intent,f.conflict)).toThrow();
});
it('DB-RESOLUTION: mixed-field choices or base/observed-version mismatches are rejected before planning',()=>{
 const f=fixture(),intent=prepareDatabaseResolution(f.source,f.remote,f.conflict,'local');expect(()=>parseDatabaseRecordIntent(f.source,{...intent,values:{[f.ids.text]:'local',[f.ids.number]:2}})).toThrow();expect(()=>parseDatabaseRecordIntent(f.source,{...intent,baseVersion:1})).toThrow();
});
it('DB-CONFLICT: invalid cell presence/triads/types or Name conflicts are not accepted as authoritative',()=>{
 const f=fixture();for(const conflict of [{...f.conflict,baseVersion:2},{...f.conflict,local:{present:false,value:null}},{...f.conflict,base:{present:false,value:'base'}},{...f.conflict,remote:f.conflict.local},{...f.conflict,local:{present:true,value:2}},{...f.conflict,propertyId:f.ids.name}])expect(()=>parseDatabaseRecordConflict(f.source,conflict)).toThrow();expect(parseDatabaseRecordConflict(f.source,f.conflict)).toEqual(f.conflict);
});
it('DB-RESOLUTION: unrelated updates allow a fresh choice while an already prepared stale resolution is rejected',()=>{
 const f=fixture(),old=prepareDatabaseResolution(f.source,f.remote,f.conflict,'local'),current=f.current({[f.ids.text]:'remote',[f.ids.number]:9},3);
 const fresh=prepareDatabaseResolution(f.source,current,f.conflict,'local');expect(fresh).toMatchObject({baseVersion:3,resolution:{remoteVersion:2}});expect(planDatabaseRecordUpdate(f.source,current,current,fresh,f.conflict)).toMatchObject({status:'merged',proposedValues:{[f.ids.text]:'local',[f.ids.number]:9}});expect(()=>planDatabaseRecordUpdate(f.source,f.remote,current,old,f.conflict)).toThrow();expect(f.conflict.remoteVersion).toBe(2);
});
it('DB-RESOLUTION: the candidate observed version cannot be replaced in a fresh resolution',()=>{
 const f=fixture(),current=f.current({[f.ids.text]:'remote',[f.ids.number]:9},3),intent=prepareDatabaseResolution(f.source,current,f.conflict,'local');
 if(intent.kind!=='update'||!intent.resolution)throw Error('fixture resolution');
 expect(()=>planDatabaseRecordUpdate(f.source,current,current,{...intent,resolution:{...intent.resolution,remoteVersion:1}},f.conflict)).toThrow();
});
it('DB-MERGE: explicit null is saved from an absent base while remote resolution preserves an absent cell',()=>{
 const f=fixture(),empty={...f.base,values:{}},saved=planDatabaseRecordUpdate(f.source,empty,empty,f.update({[f.ids.number]:null}));
 expect(saved).toMatchObject({status:'merged',changedPropertyIds:[f.ids.number],proposedValues:{[f.ids.number]:null}});
 const base={...f.base,values:{[f.ids.number]:1}},current={...base,version:2,values:{}},pending=f.update({[f.ids.number]:2}),plan=planDatabaseRecordUpdate(f.source,base,current,pending),candidate={...f.conflict,...plan.conflicts[0]!};
 const intent=prepareDatabaseResolution(f.source,current,candidate,'remote');expect(planDatabaseRecordUpdate(f.source,current,current,intent,candidate)).toMatchObject({status:'unchanged',proposedValues:{},conflicts:[]});
});
