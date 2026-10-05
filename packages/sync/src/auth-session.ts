export type AuthIdentity = Readonly<{ issuer: string; subjectId: string; expiresAt: number }>;
export interface AuthSessionPorts {
  login(email: string, password: string, signal: AbortSignal): Promise<unknown>;
  refresh(refreshToken: string, signal: AbortSignal): Promise<unknown>;
  verify(accessToken: string, signal: AbortSignal): Promise<unknown>;
  revoke(accessToken: string, signal: AbortSignal): Promise<void>;
}
export class AuthSessionError extends Error {
  constructor(readonly stage: 'closed' | 'busy' | 'credentials' | 'provider' | 'verification' | 'expired' | 'identity' | 'unavailable') {
    super(`Authentication ${stage}`); this.name = 'AuthSessionError';
  }
}
type Tokens = { access: string; refresh: string; subject: string };
function sanitized(error: unknown, fallback: AuthSessionError['stage']) {
  const stages = ['closed', 'busy', 'credentials', 'provider', 'verification', 'expired', 'identity', 'unavailable'];
  return new AuthSessionError(error instanceof AuthSessionError && stages.includes(error.stage) ? error.stage : fallback);
}
function tokens(candidate: unknown): Tokens {
  if (!candidate || typeof candidate !== 'object') throw new AuthSessionError('provider');
  const value = candidate as Record<string, unknown>, user = value.user as Record<string, unknown> | undefined;
  if (typeof value.access_token !== 'string' || value.access_token.length > 8192
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.access_token)
    || typeof value.refresh_token !== 'string' || !value.refresh_token.length || value.refresh_token.length > 4096
    || /[\r\n]/.test(value.refresh_token) || value.token_type !== 'bearer'
    || typeof user?.id !== 'string' || !user.id.trim() || user.id.length > 512) throw new AuthSessionError('provider');
  return { access: value.access_token, refresh: value.refresh_token, subject: user.id };
}
// Memory-only until a separately verified OS credential adapter exists. No storage,
// observers, token decoding, profile publication, polling or implicit retry.
export class AuthSession {
  #tokens: Tokens | null = null;
  #identity: AuthIdentity | null = null;
  #owner: Readonly<{ issuer: string; subjectId: string }> | null = null;
  #controller = new AbortController();
  #closed = false;
  #busy = false;
  readonly #issuer: string;
  readonly #ports: AuthSessionPorts;
  readonly #now: () => number;
  constructor(issuer: string, ports: AuthSessionPorts, now = () => Math.floor(Date.now() / 1000)) {
    let url: URL; try { url = new URL(issuer); } catch { throw new AuthSessionError('identity'); }
    if (url.protocol !== 'https:' || issuer !== issuer.trim() || url.username || url.password || url.search || url.hash) throw new AuthSessionError('identity');
    this.#issuer = issuer; this.#now = now;
    this.#ports = Object.freeze({ login: ports.login.bind(ports), refresh: ports.refresh.bind(ports), verify: ports.verify.bind(ports), revoke: ports.revoke.bind(ports) });
  }
  get identity(): AuthIdentity | null { return this.#identity && this.#identity.expiresAt > this.#now() ? this.#identity : null; }
  close() { this.#closed = true; this.#controller.abort(); this.#tokens = null; this.#identity = null; }
  #check(signal: AbortSignal) { if (this.#closed || signal.aborted || signal !== this.#controller.signal) throw new AuthSessionError('closed'); }
  #begin() {
    if (this.#closed) throw new AuthSessionError('closed');
    if (this.#busy) throw new AuthSessionError('busy');
    this.#busy = true; this.#controller.abort(); this.#controller = new AbortController();
    this.#identity = null; return this.#controller.signal;
  }
  async #accept(candidate: unknown, signal: AbortSignal): Promise<AuthIdentity> {
    this.#check(signal); const credentials = tokens(candidate);
    let candidateIdentity: unknown;
    try { candidateIdentity = await this.#ports.verify(credentials.access, signal); }
    catch { this.#check(signal); throw new AuthSessionError('verification'); }
    this.#check(signal);
    const identity = candidateIdentity as Record<string, unknown> | null;
    if (!identity || identity.issuer !== this.#issuer || identity.subjectId !== credentials.subject
      || !Number.isSafeInteger(identity.expiresAt) || (identity.expiresAt as number) <= this.#now()) throw new AuthSessionError('identity');
    if (this.#owner && (identity.issuer !== this.#owner.issuer || identity.subjectId !== this.#owner.subjectId)) throw new AuthSessionError('identity');
    const accepted = Object.freeze({ issuer: this.#issuer, subjectId: credentials.subject, expiresAt: identity.expiresAt as number });
    this.#tokens = credentials; this.#identity = accepted;
    this.#owner = Object.freeze({ issuer: accepted.issuer, subjectId: accepted.subjectId });
    return accepted;
  }
  async login(email: string, password: string): Promise<AuthIdentity> {
    if (typeof email !== 'string' || !email.trim() || email.length > 320 || typeof password !== 'string' || !password.length || password.length > 4096) throw new AuthSessionError('credentials');
    if (this.#tokens) throw new AuthSessionError('busy');
    const signal = this.#begin();
    try { return await this.#accept(await this.#ports.login(email, password, signal), signal); }
    catch (error) { this.#tokens = null; this.#identity = null; this.#check(signal); throw sanitized(error, 'provider'); }
    finally { this.#busy = false; }
  }
  async refresh(): Promise<AuthIdentity> {
    if (this.#closed) throw new AuthSessionError('closed');
    if (this.#busy) throw new AuthSessionError('busy');
    const previous = this.#tokens; if (!previous) throw new AuthSessionError('unavailable');
    const signal = this.#begin(); this.#tokens = null;
    try { return await this.#accept(await this.#ports.refresh(previous.refresh, signal), signal); }
    catch (error) { this.#tokens = null; this.#identity = null; this.#check(signal); throw sanitized(error, 'provider'); }
    finally { this.#busy = false; }
  }
  async authorized<T>(work: (authorization: string, signal: AbortSignal, identity: AuthIdentity) => Promise<T>): Promise<T> {
    if (this.#closed) throw new AuthSessionError('closed');
    if (this.#busy) throw new AuthSessionError('busy');
    const identity = this.identity, credentials = this.#tokens, signal = this.#controller.signal;
    if (!identity || !credentials) throw new AuthSessionError(this.#identity ? 'expired' : 'unavailable');
    try { const result = await work(`Bearer ${credentials.access}`, signal, identity); this.#check(signal);
      if (!this.identity || this.#tokens !== credentials) throw new AuthSessionError('expired'); return result; }
    catch (error) { this.#check(signal); throw sanitized(error, 'unavailable'); }
  }
  async logout(): Promise<Readonly<{ localClosed: true; providerLogoutConfirmed: boolean }>> {
    const access = this.#tokens?.access; this.close();
    if (!access) return Object.freeze({ localClosed: true, providerLogoutConfirmed: false });
    try { await this.#ports.revoke(access, AbortSignal.timeout(15_000)); return Object.freeze({ localClosed: true, providerLogoutConfirmed: true }); }
    catch { return Object.freeze({ localClosed: true, providerLogoutConfirmed: false }); }
  }
}
