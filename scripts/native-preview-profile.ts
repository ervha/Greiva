import type {privatePreviewProfile} from './private-preview-profile.js';

export type NativeOfflinePin = Readonly<{
  issuer: string;
  audience: string;
  kid: string;
  publicKeyHex: string;
}>;

export function validateNativeOfflinePin(pin: Readonly<{issuer?: string; audience?: string; kid?: string; publicKeyHex?: string}>): NativeOfflinePin {
  const {issuer, audience, kid, publicKeyHex} = pin;
  if (!issuer || !audience || !kid || !publicKeyHex) {
    throw Error('Complete explicit native offline public configuration required');
  }
  let url: URL;
  try {
    url = new URL(issuer);
  } catch {
    throw Error('Invalid native offline public configuration');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || issuer !== issuer.trim() || issuer.length > 2048) {
    throw Error('Invalid native offline public configuration');
  }
  if (!audience || audience !== audience.trim() || audience.length > 256 || /[\x00-\x1f\x7f]/.test(audience)) {
    throw Error('Invalid native offline public configuration');
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid)) {
    throw Error('Invalid native offline public configuration');
  }
  if (publicKeyHex.length !== 64 || !/^[0-9a-f]{64}$/.test(publicKeyHex)) {
    throw Error('Invalid native offline public configuration');
  }
  return Object.freeze({issuer, audience, kid, publicKeyHex});
}

function resolveOfflinePin(
  explicitPin: NativeOfflinePin | null | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env
): NativeOfflinePin | null {
  if (explicitPin !== undefined) {
    return explicitPin === null ? null : validateNativeOfflinePin(explicitPin);
  }
  const rawValues = [
    env.GREIVA_NATIVE_OFFLINE_ISSUER ?? env.VITE_GREIVA_OFFLINE_ISSUER,
    env.GREIVA_NATIVE_OFFLINE_AUDIENCE ?? env.VITE_GREIVA_OFFLINE_AUDIENCE,
    env.GREIVA_NATIVE_OFFLINE_KID ?? env.VITE_GREIVA_OFFLINE_KID,
    env.GREIVA_NATIVE_OFFLINE_PUBLIC_KEY ?? env.VITE_GREIVA_OFFLINE_PUBLIC_KEY,
  ];
  if (rawValues.every(v => v === undefined || v === '')) {
    return null;
  }
  if (rawValues.some(v => v === undefined || v === '')) {
    throw Error('Complete explicit native offline public configuration required');
  }
  return validateNativeOfflinePin({
    issuer: rawValues[0]!,
    audience: rawValues[1]!,
    kid: rawValues[2]!,
    publicKeyHex: rawValues[3]!,
  });
}

export function nativePreviewProfile(
  base: ReturnType<typeof privatePreviewProfile>,
  options: boolean | {isolatedFixture?: boolean; offlinePin?: NativeOfflinePin | null; env?: Readonly<Record<string, string | undefined>>} = false,
  explicitOfflinePin?: NativeOfflinePin | null
) {
  const isolatedFixture = typeof options === 'boolean' ? options : Boolean(options.isolatedFixture);
  const pinInput = typeof options === 'object' && options !== null && 'offlinePin' in options ? options.offlinePin : explicitOfflinePin;
  const env = typeof options === 'object' && options !== null ? options.env : undefined;
  const offlinePin = resolveOfflinePin(pinInput, env);

  const override = structuredClone(base.override), project = base.publicEnvironment.VITE_GREIVA_SUPABASE_URL;
  override.productName = 'Greiva Native Preview';
  override.app.windows[0]!.url = 'native.html';
  override.app.windows[0]!.title = 'Greiva — 端末workspace 接続プレビュー';
  if (isolatedFixture) {
    if (project !== 'https://project.fixture.invalid' || !base.publicEnvironment.VITE_GREIVA_PRIVATE_API_ORIGIN.startsWith('http://127.0.0.1:')) {
      throw Error('Fixture isolation requires fixture configuration');
    }
    override.identifier = 'dev.greiva.native.fixture';
    override.productName = 'Greiva Native Fixture';
    override.app.windows[0]!.title = 'Greiva — 端末workspace 隔離検証';
  }
  override.app.security.csp = "default-src 'self'; connect-src 'self' ipc: http://ipc.localhost " + project + "/auth/v1/signup; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'";

  const nativeEnvironment: Record<string, string> = {
    GREIVA_NATIVE_FRONTEND_ONLY: '1',
    GREIVA_NATIVE_PROJECT_URL: project,
    GREIVA_NATIVE_API_ORIGIN: base.publicEnvironment.VITE_GREIVA_PRIVATE_API_ORIGIN,
    GREIVA_NATIVE_PUBLISHABLE_KEY: base.publicEnvironment.VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY,
  };
  if (offlinePin) {
    nativeEnvironment.GREIVA_NATIVE_OFFLINE_ISSUER = offlinePin.issuer;
    nativeEnvironment.GREIVA_NATIVE_OFFLINE_AUDIENCE = offlinePin.audience;
    nativeEnvironment.GREIVA_NATIVE_OFFLINE_KID = offlinePin.kid;
    nativeEnvironment.GREIVA_NATIVE_OFFLINE_PUBLIC_KEY = offlinePin.publicKeyHex;
  }

  return {
    override,
    publicEnvironment: base.publicEnvironment,
    nativeEnvironment,
    offlinePin,
  };
}
