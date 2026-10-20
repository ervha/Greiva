import type {privatePreviewProfile} from './private-preview-profile.js';

export type NativeOfflinePin = Readonly<{
  issuer: string;
  audience: string;
  kid: string;
  publicKeyHex: string;
}>;

const ED25519_P = 2n ** 255n - 19n;
const ED25519_D = (ED25519_P - 121665n) * modPow(121666n, ED25519_P - 2n, ED25519_P) % ED25519_P;

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp = exp / 2n;
  }
  return res;
}

const SMALL_ORDER_HEX = new Set([
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0100000000000000000000000000000000000000000000000000000000000000',
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
  '13e7958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85',
  'd4166a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
  'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
  '0000000000000000000000000000000000000000000000000000000000000080',
]);

export function isCanonicalEd25519PublicKey(hex: string): boolean {
  if (hex.length !== 64 || !/^[0-9a-f]{64}$/.test(hex)) return false;
  if (SMALL_ORDER_HEX.has(hex)) return false;
  const bytes = Buffer.from(hex, 'hex');
  const xBit = (bytes[31]! & 0x80) !== 0;
  bytes[31] = bytes[31]! & 0x7f;
  let y = 0n;
  for (let i = 0; i < 32; i++) {
    y |= BigInt(bytes[i]!) << BigInt(i * 8);
  }
  if (y >= ED25519_P) return false;
  const y2 = (y * y) % ED25519_P;
  const u = (y2 - 1n + ED25519_P) % ED25519_P;
  const v = (ED25519_D * y2 + 1n) % ED25519_P;
  if (v === 0n) return false;
  const invV = modPow(v, ED25519_P - 2n, ED25519_P);
  const w = (u * invV) % ED25519_P;
  if (w === 0n) return !xBit;
  return modPow(w, (ED25519_P - 1n) / 2n, ED25519_P) === 1n;
}

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
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    issuer !== issuer.trim() ||
    Buffer.byteLength(issuer, 'utf8') > 2048 ||
    /\p{Control}/u.test(issuer)
  ) {
    throw Error('Invalid native offline public configuration');
  }
  if (
    !audience ||
    audience !== audience.trim() ||
    Buffer.byteLength(audience, 'utf8') > 256 ||
    /\p{Control}/u.test(audience)
  ) {
    throw Error('Invalid native offline public configuration');
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid)) {
    throw Error('Invalid native offline public configuration');
  }
  if (!isCanonicalEd25519PublicKey(publicKeyHex)) {
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
  if (rawValues.every(v => v === undefined)) {
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
