import {privateApiOrigin,supabaseConfiguration} from '@greiva/shared';
export const privatePreviewIdentifier='dev.greiva.private.preview';
export function privatePreviewProfile(environment:Readonly<Record<string,string|undefined>>){
 const project=environment.VITE_GREIVA_SUPABASE_URL??'',algorithm=environment.VITE_GREIVA_SUPABASE_ALGORITHM,key=environment.VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY??'',api=environment.VITE_GREIVA_PRIVATE_API_ORIGIN??'';
 if(!['ES256','RS256'].includes(algorithm??'')||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)||key.length>512)throw Error('Invalid private preview public configuration');
 const provider=supabaseConfiguration(project,algorithm as 'ES256'|'RS256'),origin=privateApiOrigin(api);
 const publicEnvironment={VITE_GREIVA_SUPABASE_URL:provider.projectUrl,VITE_GREIVA_SUPABASE_ALGORITHM:algorithm!,VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:key,VITE_GREIVA_PRIVATE_API_ORIGIN:origin,VITE_GREIVA_TEST_HOOKS:'0',VITE_GREIVA_TEST_SQLITE:'0'};
 const origins=[...new Set([provider.projectUrl,origin])];
 const override={productName:'Greiva Private Preview',identifier:privatePreviewIdentifier,app:{windows:[{label:'main',title:'Greiva — 個人workspace 接続プレビュー',url:'workspace.html',useHttpsScheme:false,width:1000,height:700,dragDropEnabled:false}],security:{csp:"default-src 'self'; connect-src 'self' ipc: http://ipc.localhost "+origins.join(' ')+"; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'"}},bundle:{active:false}};
 return{override,publicEnvironment,origins};
}