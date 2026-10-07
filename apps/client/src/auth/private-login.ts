import { newId, idSchema } from '@greiva/shared';
import { NativeWorkspaceDeviceError } from '../workspace/native-workspace-device.js';
import { supabaseAuthSession, PrivateWorkspaceConnection, PrivateConnectionError, type AuthIdentity, type AuthSession, type WorkspaceSyncContext } from '@greiva/sync';

export type PrivateLoginConfiguration = Readonly<{ projectUrl: string; publishableKey: string; algorithm: 'ES256' | 'RS256'; apiUrl: string }>;
export type LoginPhase = 'signed_out' | 'logging_in' | 'preparing_device' | 'verified' | 'registering' | 'ready' | 'refreshing' | 'expired' | 'signing_out' | 'configuration';
export type LoginSnapshot = Readonly<{ phase: LoginPhase; busy: boolean; identity: AuthIdentity | null; context: WorkspaceSyncContext | null; message: string | null }>;
const busyPhases: readonly LoginPhase[] = ['logging_in', 'preparing_device', 'registering', 'refreshing', 'signing_out'];
export type PrivateDeviceIdentityPort = (identity: AuthIdentity, signal: AbortSignal) => Promise<string>;

// Verification screen only: no content store, offline grant, token storage or
// automatic bootstrap/refresh. Native composition may persist owner/device
// metadata through the explicit port. Every login owns a fresh auth pair.
export class PrivateLoginController {
  readonly #config: PrivateLoginConfiguration;
  readonly #fetch: typeof fetch;
  #auth: AuthSession | null = null;
  #connection: PrivateWorkspaceConnection | null = null;
  #phase: LoginPhase = 'signed_out';
  #message: string | null = null;
  #revision = 0;
  #disposed = false;
  #listeners = new Set<(snapshot: LoginSnapshot) => void>();
  #expiry: ReturnType<typeof setTimeout> | undefined;
  constructor(configuration: PrivateLoginConfiguration, fetchPort: typeof fetch = globalThis.fetch, private readonly deviceIdentity: PrivateDeviceIdentityPort = async () => newId()) {
    this.#config = Object.freeze({ ...configuration }); this.#fetch = fetchPort;
    try { const probe = supabaseAuthSession(this.#config, fetchPort); probe.close(); }
    catch { this.#phase = 'configuration'; this.#message = '接続設定が不足しているか、正しくありません。'; }
  }
  get snapshot(): LoginSnapshot {
    const rotating = ['logging_in', 'preparing_device', 'refreshing', 'signing_out'].includes(this.#phase);
    return Object.freeze({ phase: this.#phase, busy: busyPhases.includes(this.#phase), identity: rotating ? null : this.#auth?.identity ?? null,
      context: rotating ? null : this.#connection?.context ?? null, message: this.#message });
  }
  subscribe(listener: (snapshot: LoginSnapshot) => void) { if (this.#disposed) return () => {}; this.#listeners.add(listener); listener(this.snapshot); return () => { this.#listeners.delete(listener); }; }
  #publish() { if (!this.#disposed) for (const listener of this.#listeners) listener(this.snapshot); }
  #clearTimer() { clearTimeout(this.#expiry); this.#expiry = undefined; }
  #expire() {
    this.#clearTimer(); const identity = this.#auth?.identity; if (!identity) return;
    // Recheck long lifetimes in bounded timer intervals; no implicit refresh.
    this.#expiry = setTimeout(() => {
      if (this.#auth?.identity) this.#expire();
      else { this.#phase = 'expired'; this.#message = '認証の有効期限が切れました。認証を更新するか、ログインし直してください。'; this.#publish(); }
    }, Math.min(2_147_483_647, Math.max(1, identity.expiresAt * 1000 - Date.now())));
  }
  #begin(phase: LoginPhase) {
    if (this.#disposed || this.#phase === 'configuration' || this.snapshot.busy) return null;
    this.#clearTimer(); this.#phase = phase; this.#message = null; const revision = ++this.#revision; this.#publish(); return revision;
  }
  #current(revision: number) { return !this.#disposed && revision === this.#revision; }
  #release() { this.#clearTimer(); this.#connection?.close(); this.#auth?.close(); this.#connection = null; this.#auth = null; }
  close() { if (this.#disposed || this.#phase === 'configuration') return; ++this.#revision; this.#release(); this.#phase = 'signed_out'; this.#message = 'この画面の接続を閉じました。'; this.#publish(); }
  dispose() { this.#disposed = true; ++this.#revision; this.#release(); this.#listeners.clear(); }
  async login(email: string, password: string) {
    const revision = this.#begin('logging_in'); if (revision === null) return;
    this.#release();
    const auth = supabaseAuthSession(this.#config, this.#fetch); this.#auth = auth;
    try {
      await auth.login(email, password); if (!this.#current(revision)) return;
      this.#phase = 'preparing_device'; this.#publish();
      const deviceIdentity = this.deviceIdentity;
      const clientId = await auth.authorized(async (_authorization, signal, identity) => idSchema.parse(await deviceIdentity(identity, signal)));
      if (!this.#current(revision)) return;
      this.#connection = new PrivateWorkspaceConnection(auth, { apiUrl: this.#config.apiUrl, clientId }, this.#fetch);
      this.#phase = 'verified'; this.#expire();
    } catch (error) { if (!this.#current(revision)) return; const deviceFailed = this.#phase === 'preparing_device' || error instanceof NativeWorkspaceDeviceError;
      this.#release(); this.#phase = 'signed_out'; this.#message = deviceFailed ? 'この端末の登録情報を確認できませんでした。保存先を確認して、もう一度ログインしてください。' : 'ログインを確認できませんでした。入力内容・接続先・ネットワークを確認してください。'; }
    this.#publish();
  }
  async register() {
    const connection = this.#connection; if (!connection || !this.#auth?.identity) return;
    const revision = this.#begin('registering'); if (revision === null) return;
    try { await connection.bootstrap(); if (!this.#current(revision)) return; this.#phase = 'ready'; }
    catch (error) { if (!this.#current(revision)) return;
      if (error instanceof PrivateConnectionError && ['closed', 'authentication', 'access_denied', 'binding'].includes(error.stage)) {
        this.#release(); this.#phase = 'signed_out'; this.#message = 'workspaceへの接続を続けられません。もう一度ログインしてください。';
      } else { this.#phase = this.#auth?.identity ? 'verified' : 'expired'; this.#message = 'workspace登録を確認できませんでした。ネットワークを確認して、もう一度お試しください。'; }
    }
    this.#expire(); this.#publish();
  }
  async refresh() {
    const auth = this.#auth; if (!auth) return;
    const revision = this.#begin('refreshing'); if (revision === null) return;
    try { await auth.refresh(); if (!this.#current(revision)) return; this.#phase = 'verified'; this.#expire(); }
    catch { if (!this.#current(revision)) return; this.#release(); this.#phase = 'signed_out'; this.#message = '認証を更新できませんでした。もう一度ログインしてください。'; }
    this.#publish();
  }
  async logout() {
    const auth = this.#auth; if (!auth) { this.close(); return; }
    const revision = this.#begin('signing_out'); if (revision === null) return;
    this.#connection?.close(); this.#connection = null;
    const work = auth.logout(); this.#auth = null; this.#publish();
    const result = await work; if (!this.#current(revision)) return;
    this.#phase = 'signed_out'; this.#message = result.providerLogoutConfirmed ? 'この画面からログアウトしました。' : 'この画面のログイン状態を破棄しました。サーバー側のログアウトは確認できませんでした。'; this.#publish();
  }
}
