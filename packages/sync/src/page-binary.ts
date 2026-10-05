import * as Y from 'yjs';
// Portable V1 validation. No Buffer, Node crypto or Editor JSON projection.
export function pageBase64(bytes:Uint8Array):string {
  let raw='';for(let offset=0;offset<bytes.length;offset+=8192)raw+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
  return btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function pageBytes(candidate:string):Uint8Array {
  if(!/^[A-Za-z0-9_-]+$/.test(candidate))throw Error();
  const raw=atob(candidate.replaceAll('-','+').replaceAll('_','/')),bytes=Uint8Array.from(raw,char=>char.charCodeAt(0));
  if(!bytes.length || pageBase64(bytes)!==candidate)throw Error();return bytes;
}
export async function pageDigest(bytes:Uint8Array):Promise<string> {
  const hash=await globalThis.crypto.subtle.digest('SHA-256',Uint8Array.from(bytes));
  return Array.from(new Uint8Array(hash),value=>value.toString(16).padStart(2,'0')).join('');
}
export function pageUpdateBytes(candidate:string):Uint8Array {
  const bytes=pageBytes(candidate);let reader:ConstructorParameters<typeof Y.UpdateDecoderV1>[0]|undefined;
  class CompleteDecoder extends Y.UpdateDecoderV1 {constructor(...args:ConstructorParameters<typeof Y.UpdateDecoderV1>){super(...args);reader=args[0];}}
  Y.decodeUpdateV2(bytes,CompleteDecoder);if(!reader || reader.pos!==bytes.length)throw Error();
  const doc=new Y.Doc({gc:false});try{Y.applyUpdate(doc,bytes);}finally{doc.destroy();}return bytes;
}
export function pageVectorBytes(candidate:string):Uint8Array {
  const bytes=pageBytes(candidate);if(pageBase64(Y.encodeStateVector(Y.decodeStateVector(bytes)))!==candidate)throw Error();return bytes;
}
