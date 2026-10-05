import { idSchema, privateApiOrigin } from '@greiva/shared';
import {PageSyncSession,type PageSessionStore} from './page-session.js';
import { privateBootstrapResponseSchema } from '@greiva/protocol/workspace';
import { AuthSession, AuthSessionError, type AuthIdentity } from './auth-session.js';
import { WorkspaceSyncSession, type WorkspaceSyncContext, type WorkspaceSessionStore } from './workspace-session.js';

export class PrivateConnectionError extends Error {
  constructor(readonly stage: 'closed' | 'busy' | 'authentication' | 'configuration' | 'transport' | 'protocol' | 'binding' | 'access_denied') {
    super(`Private workspace connection ${stage}`); this.name = 'PrivateConnectionError';
  }
}
function sameOwner(identity: AuthIdentity | null, context: Pick<WorkspaceSyncContext, 'issuer' | 'subjectId'>) {
  return identity?.issuer === context.issuer && identity.subjectId === context.subjectId;
}
// Connection and API origin are trusted composition, never selected from claims.
// Captures the exact auth generation's AbortSignal. Refresh/close permanently
// closes old sync sessions; a fresh bootstrap may reopen the same durable store.
export class PrivateWorkspaceConnection {
  readonly #auth: AuthSession;
  readonly #api: string;
  readonly #clientId: string;
  readonly #fetch: typeof fetch;
  #context: WorkspaceSyncContext | null = null;
  #lease: AbortSignal | null = null;
  #busy = false;
  #closed = false;
  #controller = new AbortController();
  #session: WorkspaceSyncSession | null = null;
  #pages = new Map<string,{session:PageSyncSession;detach:()=>void}>();
  #detach: (() => void) | null = null;
  constructor(auth: AuthSession, configuration: Readonly<{ apiUrl: string; clientId: string }>, fetchPort: typeof fetch = globalThis.fetch) {
    try { this.#api = privateApiOrigin(configuration.apiUrl); this.#clientId = idSchema.parse(configuration.clientId); }
    catch { throw new PrivateConnectionError('configuration'); }
    this.#auth = auth; this.#fetch = fetchPort;
  }
  get context(): WorkspaceSyncContext | null {
    return !this.#closed && this.#lease && !this.#lease.aborted && this.#context && sameOwner(this.#auth.identity, this.#context) ? this.#context : null;
  }
  get generationSignal():AbortSignal|null {return this.context?this.#lease:null;}
  close() { for(const page of this.#pages.values()){page.session.close();page.detach();}this.#pages.clear();this.#closed = true; this.#controller.abort(); this.#session?.close(); this.#detach?.(); this.#session = null; this.#detach = null; }
  #active(context: WorkspaceSyncContext, lease: AbortSignal) {
    if (this.#closed || lease.aborted || lease !== this.#lease) throw new PrivateConnectionError('closed');
    if (!sameOwner(this.#auth.identity, context)) throw new PrivateConnectionError('authentication');
  }
  async #call(path: string, body: unknown, external: AbortSignal | undefined, expected?: { context: WorkspaceSyncContext; lease: AbortSignal }) {
    if (this.#closed) throw new PrivateConnectionError('closed');
    if (!this.#auth.identity) throw new PrivateConnectionError('authentication');
    // Browser fetch must be invoked as a function, not as a method with this
    // connection as its native receiver (which browsers reject).
    const fetchPort = this.#fetch;
    let result: { status: number; value: unknown; validJson: boolean; identity: AuthIdentity; lease: AbortSignal };
    try {
      result = await this.#auth.authorized(async (authorization, lease, identity) => {
        if (expected) this.#active(expected.context, expected.lease);
        const signal = AbortSignal.any([lease, this.#controller.signal, AbortSignal.timeout(15_000), ...(external ? [external] : [])]);
        const response = await fetchPort(this.#api + path, { method: 'POST', headers: { authorization, 'content-type': 'application/json' },
          body: typeof body === 'string' ? body : JSON.stringify(body), credentials: 'omit', redirect: 'error', cache: 'no-store', signal });
        let value: unknown, validJson = true; try { value = await response.json(); } catch { validJson = false; }
        return { status: response.status, value, validJson, identity, lease };
      });
    } catch (error) {
      if (this.#closed || expected?.lease.aborted || external?.aborted) throw new PrivateConnectionError('closed');
      throw new PrivateConnectionError(error instanceof AuthSessionError && ['closed', 'expired', 'identity', 'unavailable', 'busy'].includes(error.stage)
        ? error.stage === 'unavailable' ? 'transport' : error.stage === 'busy' ? 'busy' : error.stage === 'closed' ? 'closed' : 'authentication' : 'transport');
    }
    if (this.#closed || result.lease.aborted || external?.aborted || !sameOwner(this.#auth.identity, result.identity)) throw new PrivateConnectionError('closed');
    if (result.status === 401) { this.close(); throw new PrivateConnectionError('authentication'); }
    if (result.status === 403) { this.close(); throw new PrivateConnectionError('access_denied'); }
    if (result.status < 200 || result.status >= 300) throw new PrivateConnectionError('transport');
    if (!result.validJson) throw new PrivateConnectionError('protocol');
    return result;
  }
  async bootstrap(): Promise<WorkspaceSyncContext> {
    if (this.#closed) throw new PrivateConnectionError('closed');
    if (this.#busy) throw new PrivateConnectionError('busy');
    this.#busy = true;
    try {
      const result = await this.#call('/v1/workspaces/bootstrap', { clientId: this.#clientId }, undefined);
      const parsed = privateBootstrapResponseSchema.safeParse(result.value);
      if (!parsed.success || parsed.data.clientId !== this.#clientId) throw new PrivateConnectionError('protocol');
      const context = Object.freeze({ issuer: result.identity.issuer, subjectId: result.identity.subjectId, workspaceId: parsed.data.workspaceId,
        clientId: parsed.data.clientId, streamEpoch: parsed.data.epoch });
      if (this.#context && Object.entries(context).some(([key, value]) => this.#context![key as keyof WorkspaceSyncContext] !== value)) { this.close(); throw new PrivateConnectionError('binding'); }
      this.#context = context; this.#lease = result.lease;
      return context;
    } finally { this.#busy = false; }
  }
  openSync(store: WorkspaceSessionStore): WorkspaceSyncSession {
    const context = this.context, lease = this.#lease;
    if (!context || !lease) throw new PrivateConnectionError(this.#closed ? 'closed' : 'authentication');
    this.#session?.close(); this.#detach?.();
    const acknowledge = store.acknowledge.bind(store), applyPull = store.applyPull.bind(store);
    const session = new WorkspaceSyncSession(context, {
      transport: {
        push: async (wire, signal) => (await this.#call(`/v1/workspaces/${context.workspaceId}/sync/push`, wire, signal, { context, lease })).value,
        pull: async (request, signal) => (await this.#call(`/v1/workspaces/${context.workspaceId}/sync/pull`, request, signal, { context, lease })).value,
      },
      store: {
        acknowledge: async (...args) => { this.#active(context, lease); await acknowledge(...args); this.#active(context, lease); },
        applyPull: async (...args) => { this.#active(context, lease); await applyPull(...args); this.#active(context, lease); },
      },
    });
    this.#session = session;
    const invalidated = () => { session.close(); if (this.#session === session) this.#session = null; };
    lease.addEventListener('abort', invalidated, { once: true });
    this.#detach = () => lease.removeEventListener('abort', invalidated);
    return session;
  }
  openPage(candidateId:string,store:PageSessionStore):PageSyncSession {
    const context=this.context,lease=this.#lease;if(!context || !lease)throw new PrivateConnectionError(this.#closed?'closed':'authentication');
    let pageId:string;try{pageId=idSchema.parse(candidateId);}catch{throw new PrivateConnectionError('configuration');}
    const previous=this.#pages.get(pageId);previous?.session.close();previous?.detach();
    const acknowledge=store.acknowledge.bind(store),receive=store.receive.bind(store),path='/v1/workspaces/'+context.workspaceId+'/pages/'+pageId+'/document/';
    const session=new PageSyncSession({...context,pageId,documentName:'page:'+pageId,editorSchemaVersion:1},{
      transport:{push:async(kind,wire,signal)=>(await this.#call(path+kind,wire,signal,{context,lease})).value,read:async(request,signal)=>(await this.#call(path+'read',request,signal,{context,lease})).value},
      store:{acknowledge:async(...args)=>{this.#active(context,lease);await acknowledge(...args);this.#active(context,lease);},receive:async(...args)=>{this.#active(context,lease);await receive(...args);this.#active(context,lease);}},
    });
    const invalidated=()=>{session.close();if(this.#pages.get(pageId)?.session===session)this.#pages.delete(pageId);};lease.addEventListener('abort',invalidated,{once:true});
    this.#pages.set(pageId,{session,detach:()=>lease.removeEventListener('abort',invalidated)});return session;
  }

}
