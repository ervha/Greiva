import { it,expect,vi } from 'vitest';
import type pg from 'pg';
import { newId } from '@greiva/shared';
import { PostgresPrivateStructuredStore,PrivateSyncInvalidRequest } from '../../apps/api/src/private-structured-store.js';

it('PRIVATE-STREAM: strict push scope/client/duplicate envelopes reject before DB acquisition',async()=>{
  const connect=vi.fn(),store=new PostgresPrivateStructuredStore({connect} as unknown as pg.Pool,'greiva_private_fixture'),workspaceId=newId(),clientId=newId(),session={issuer:'https://fixture.invalid',subjectId:'owner',expiresAt:Math.floor(Date.now()/1000)+300},operation={operationId:newId(),clientId,entityType:'task',entityId:newId(),kind:'create',baseVersion:null,payload:{title:'fixture',status:'todo',due:null}},request={protocolVersion:1,workspaceId,clientId,operations:[operation]};
  for(const body of [{...request,subjectId:'owner'},{...request,operations:[operation,operation]},{...request,clientId:newId()}, {...request,protocolVersion:99},{...request,workspaceId:newId()}])await expect(store.push(session,workspaceId,body)).rejects.toBeInstanceOf(PrivateSyncInvalidRequest);
  expect(connect).not.toHaveBeenCalled();
});
it('PRIVATE-STREAM: malformed pull limits, old cursor envelopes and foreign path scope reject before DB acquisition',async()=>{
  const connect=vi.fn(),store=new PostgresPrivateStructuredStore({connect} as unknown as pg.Pool,'greiva_private_fixture'),workspaceId=newId(),clientId=newId(),session={issuer:'https://fixture.invalid',subjectId:'owner',expiresAt:Math.floor(Date.now()/1000)+300},request={protocolVersion:1,workspaceId,clientId,cursor:null};
  for(const body of [{...request,limit:501},{...request,limit:0},{cursor:null},{...request,workspaceId:newId()},{...request,actor:'owner'}])await expect(store.pull(session,workspaceId,body)).rejects.toBeInstanceOf(PrivateSyncInvalidRequest);
  expect(connect).not.toHaveBeenCalled();
});
