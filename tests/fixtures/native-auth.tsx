import {createRoot} from 'react-dom/client';
import {NativeAuthScreen} from '../../apps/client/src/auth/NativeAuthScreen';
import {NativeLoginController} from '../../apps/client/src/auth/native-login-controller';
import {NativeSessionPort} from '../../apps/client/src/auth/native-session-port';
import '../../apps/client/src/style.css';import '../../apps/client/src/auth/style.css';import '../../apps/client/src/auth/native-style.css';
if(import.meta.env.VITE_GREIVA_TEST_HOOKS!=='1')throw Error('Test fixture disabled');
const invoke=async(command:string,args?:Record<string,unknown>)=>{const response=await fetch('/native-fixture/invoke',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command,args})});if(!response.ok)throw Error('fixture command failed');return response.json();};
const controller=new NativeLoginController(new NativeSessionPort(invoke),{projectUrl:'https://project.fixture.invalid',algorithm:'ES256',publishableKey:'sb_publishable_fixture'});
createRoot(document.getElementById('root')!).render(<NativeAuthScreen controller={controller}/>);
