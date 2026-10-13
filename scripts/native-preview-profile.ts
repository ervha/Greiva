import type {privatePreviewProfile} from './private-preview-profile.js';
export function nativePreviewProfile(base:ReturnType<typeof privatePreviewProfile>,isolatedFixture=false){
 const override=structuredClone(base.override),project=base.publicEnvironment.VITE_GREIVA_SUPABASE_URL;
 override.productName='Greiva Native Preview';override.app.windows[0]!.url='native.html';override.app.windows[0]!.title='Greiva — 端末workspace 接続プレビュー';
 if(isolatedFixture){if(project!=='https://project.fixture.invalid'||!base.publicEnvironment.VITE_GREIVA_PRIVATE_API_ORIGIN.startsWith('http://127.0.0.1:'))throw Error('Fixture isolation requires fixture configuration');override.identifier='dev.greiva.native.fixture';override.productName='Greiva Native Fixture';override.app.windows[0]!.title='Greiva — 端末workspace 隔離検証';}
 override.app.security.csp="default-src 'self'; connect-src 'self' ipc: http://ipc.localhost "+project+"/auth/v1/signup; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'";
 return{override,publicEnvironment:base.publicEnvironment,nativeEnvironment:{GREIVA_NATIVE_FRONTEND_ONLY:'1',GREIVA_NATIVE_PROJECT_URL:project,GREIVA_NATIVE_API_ORIGIN:base.publicEnvironment.VITE_GREIVA_PRIVATE_API_ORIGIN,GREIVA_NATIVE_PUBLISHABLE_KEY:base.publicEnvironment.VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY}};
}
