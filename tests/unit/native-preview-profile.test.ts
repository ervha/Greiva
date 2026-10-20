import {it,expect} from 'vitest';import {privatePreviewProfile} from '../../scripts/private-preview-profile.js';import {nativePreviewProfile,validateNativeOfflinePin} from '../../scripts/native-preview-profile.js';

const fixturePin={issuer:'https://auth.fixture.invalid',audience:'native',kid:'offline-fixture-v1',publicKeyHex:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'};

it('NATIVE-PREVIEW: validated settings bind native/client deployments without changing legacy profile or shipping browser token access',()=>{
 const base=privatePreviewProfile({VITE_GREIVA_SUPABASE_URL:'https://project.fixture.invalid',VITE_GREIVA_SUPABASE_ALGORITHM:'ES256',VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_GREIVA_PRIVATE_API_ORIGIN:'http://127.0.0.1:1439'}),native=nativePreviewProfile(base);
 expect(base.override.app.windows[0]?.url).toBe('workspace.html');expect(native.override.app.windows[0]?.url).toBe('native.html');expect(native.nativeEnvironment).toEqual({GREIVA_NATIVE_FRONTEND_ONLY:'1',GREIVA_NATIVE_PROJECT_URL:base.publicEnvironment.VITE_GREIVA_SUPABASE_URL,GREIVA_NATIVE_API_ORIGIN:base.publicEnvironment.VITE_GREIVA_PRIVATE_API_ORIGIN,GREIVA_NATIVE_PUBLISHABLE_KEY:base.publicEnvironment.VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY});expect(native.override.app.security.csp).toContain('https://project.fixture.invalid/auth/v1/signup;');expect(native.override.app.security.csp).not.toContain('http://127.0.0.1:1439');expect(JSON.stringify(native.override)).not.toContain('sb_publishable');expect(native.offlinePin).toBeNull();
});

it('NATIVE-PREVIEW: host startup fixture uses a separate app/data namespace and refuses live provider settings',()=>{
 const base=privatePreviewProfile({VITE_GREIVA_SUPABASE_URL:'https://project.fixture.invalid',VITE_GREIVA_SUPABASE_ALGORITHM:'ES256',VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_GREIVA_PRIVATE_API_ORIGIN:'http://127.0.0.1:1439'});expect(nativePreviewProfile(base,true).override.identifier).toBe('dev.greiva.native.fixture');expect(base.override.identifier).toBe('dev.greiva.private.preview');expect(()=>nativePreviewProfile({...base,publicEnvironment:{...base.publicEnvironment,VITE_GREIVA_SUPABASE_URL:'https://live.invalid'}},true)).toThrow('Fixture isolation requires fixture configuration');
});

it('NATIVE-PREVIEW: explicit offline pin binds verified Ed25519 public pin to native build environment',()=>{
 const base=privatePreviewProfile({VITE_GREIVA_SUPABASE_URL:'https://project.fixture.invalid',VITE_GREIVA_SUPABASE_ALGORITHM:'ES256',VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_GREIVA_PRIVATE_API_ORIGIN:'http://127.0.0.1:1439'});
 const configured=nativePreviewProfile(base,{isolatedFixture:true,offlinePin:fixturePin});
 expect(configured.offlinePin).toEqual(fixturePin);
 expect(configured.nativeEnvironment.GREIVA_NATIVE_OFFLINE_ISSUER).toBe(fixturePin.issuer);
 expect(configured.nativeEnvironment.GREIVA_NATIVE_OFFLINE_AUDIENCE).toBe(fixturePin.audience);
 expect(configured.nativeEnvironment.GREIVA_NATIVE_OFFLINE_KID).toBe(fixturePin.kid);
 expect(configured.nativeEnvironment.GREIVA_NATIVE_OFFLINE_PUBLIC_KEY).toBe(fixturePin.publicKeyHex);
});

it('NATIVE-PREVIEW: offline pin rejects partial, non-canonical, or non-https configuration',()=>{
 expect(()=>validateNativeOfflinePin({...fixturePin,issuer:'http://insecure.invalid'})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,issuer:'https://auth.invalid?q=1'})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,publicKeyHex:fixturePin.publicKeyHex.toUpperCase()})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,publicKeyHex:'0123'})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,publicKeyHex:'0'.repeat(64)})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,publicKeyHex:'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f'})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,kid:'bad kid with spaces'})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,audience:'control\x00char'})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,audience:'bad\u0085control'})).toThrow('Invalid native offline public configuration');
 expect(()=>validateNativeOfflinePin({...fixturePin,audience:'🦀'.repeat(128)})).toThrow('Invalid native offline public configuration');
 expect(()=>nativePreviewProfile(privatePreviewProfile({VITE_GREIVA_SUPABASE_URL:'https://project.fixture.invalid',VITE_GREIVA_SUPABASE_ALGORITHM:'ES256',VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_GREIVA_PRIVATE_API_ORIGIN:'http://127.0.0.1:1439'}),{env:{GREIVA_NATIVE_OFFLINE_ISSUER:'https://auth.invalid'}})).toThrow('Complete explicit native offline public configuration required');
 expect(()=>nativePreviewProfile(privatePreviewProfile({VITE_GREIVA_SUPABASE_URL:'https://project.fixture.invalid',VITE_GREIVA_SUPABASE_ALGORITHM:'ES256',VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_GREIVA_PRIVATE_API_ORIGIN:'http://127.0.0.1:1439'}),{env:{GREIVA_NATIVE_OFFLINE_ISSUER:'',GREIVA_NATIVE_OFFLINE_AUDIENCE:'',GREIVA_NATIVE_OFFLINE_KID:'',GREIVA_NATIVE_OFFLINE_PUBLIC_KEY:''}})).toThrow('Complete explicit native offline public configuration required');
 expect(nativePreviewProfile(privatePreviewProfile({VITE_GREIVA_SUPABASE_URL:'https://project.fixture.invalid',VITE_GREIVA_SUPABASE_ALGORITHM:'ES256',VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_GREIVA_PRIVATE_API_ORIGIN:'http://127.0.0.1:1439'}),{env:{}}).offlinePin).toBeNull();
});
