import { it,expect } from 'vitest';
import { mkdtemp,mkdir,writeFile,chmod,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';import path from 'node:path';
import { generateKeyPair,exportJWK } from 'jose';
import { offlineConfiguration,loadOfflineSigningKey } from '../../apps/api/src/private-offline-configuration.js';
import { privateRuntimeConfiguration,startPrivateApi } from '../../apps/api/src/private-runtime.js';
it('OFFLINE-CONFIG: absent disables; partial, unsafe and caller-controlled key metadata refuse',()=>{
  expect(offlineConfiguration({})).toBeUndefined();
  const env={GREIVA_OFFLINE_ISSUER:'https://api.fixture.invalid',GREIVA_OFFLINE_AUDIENCE:'native',GREIVA_OFFLINE_KID:'one',GREIVA_OFFLINE_KEY_FILE:'/run/secrets/key.json'};
  expect(offlineConfiguration(env)?.kid).toBe('one');
  for(const change of [{GREIVA_OFFLINE_ISSUER:undefined},{GREIVA_OFFLINE_AUDIENCE:''},{GREIVA_OFFLINE_ISSUER:'http://api.invalid'},{GREIVA_OFFLINE_KID:'bad/kid'},{GREIVA_OFFLINE_KEY_FILE:'relative.json'}])expect(()=>offlineConfiguration({...env,...change})).toThrow('Offline signing configuration unavailable');
});
it('OFFLINE-CONFIG: private bounded file and matching Ed25519 key; no symlink/public/oversize/mismatched-key fallback',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'greiva-offline-config-'));
  try{
    const keys=await generateKeyPair('EdDSA',{extractable:true}),other=await generateKeyPair('EdDSA',{extractable:true});const jwk=await exportJWK(keys.privateKey),otherPublic=await exportJWK(other.publicKey);
    const file=path.join(root,'key.json'),config={issuer:'https://api.fixture.invalid',audience:'native',kid:'one',keyFile:file};
    await writeFile(file,JSON.stringify(jwk),{mode:0o600});const key=await loadOfflineSigningKey(config);expect(key.type).toBe('private');expect(key.extractable).toBe(false);
    const link=path.join(root,'link.json');await symlink(file,link);await expect(loadOfflineSigningKey({...config,keyFile:link})).rejects.toThrow('Offline signing configuration unavailable');
    await chmod(file,0o644);await expect(loadOfflineSigningKey(config)).rejects.toThrow('Offline signing configuration unavailable');await chmod(file,0o600);
    for(const data of [JSON.stringify({...jwk,x:otherPublic.x}),JSON.stringify({...jwk,extra:'not allowed'}),JSON.stringify(await exportJWK(keys.publicKey)),'x'.repeat(4097),'not json']){await writeFile(file,data);await expect(loadOfflineSigningKey(config)).rejects.toThrow('Offline signing configuration unavailable');}
    const directory=path.join(root,'directory');await mkdir(directory,{mode:0o700});await expect(loadOfflineSigningKey({...config,keyFile:directory})).rejects.toThrow('Offline signing configuration unavailable');
  }finally{await rm(root,{recursive:true,force:true});}
});
it('OFFLINE-CONFIG: configured missing key fails before opening database/listener',async()=>{
  let calls=0;
  const config=privateRuntimeConfiguration({GREIVA_SUPABASE_URL:'https://auth.fixture.invalid',GREIVA_SUPABASE_ALGORITHM:'ES256',DATABASE_URL:'postgres://fixture:fixture@localhost/test',GREIVA_PRIVATE_SCHEMA:'greiva_private_fixture',GREIVA_OFFLINE_ISSUER:'https://api.fixture.invalid',GREIVA_OFFLINE_AUDIENCE:'native',GREIVA_OFFLINE_KID:'one',GREIVA_OFFLINE_KEY_FILE:'/missing/synthetic-key.json'});
  await expect(startPrivateApi(config,{poolFactory:()=>{++calls;throw Error();}})).rejects.toThrow('Private API configuration failed');expect(calls).toBe(0);
});
