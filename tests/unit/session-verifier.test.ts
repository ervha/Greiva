import { describe, it, expect, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT, CompactSign } from 'jose';
import { sessionVerifier, SessionVerificationError, type SessionConfiguration } from '../../apps/api/src/session-verifier.js';
import { authenticatedPrivateAccess } from '../../apps/api/src/authenticated-private-access.js';
import { newId } from '@greiva/shared';
import type { PrivateAccessSnapshot, ResourceReference } from '@greiva/domain';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';

async function fixture() {
  const configuration = { issuer: 'https://auth.fixture.invalid/auth/v1', audience: 'authenticated', jwksUrl: 'https://auth.fixture.invalid/auth/v1/.well-known/jwks.json', algorithms: ['ES256'] as ('ES256'|'RS256')[] };
  const keys = await generateKeyPair('ES256', { extractable: true }), jwk = { ...await exportJWK(keys.publicKey), kid: 'current', alg: 'ES256', use: 'sig' };
  const response = () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetcher = vi.fn<typeof globalThis.fetch>(async () => response());
  const verifier = sessionVerifier(configuration, fetcher);
  const claims = () => ({ iss: configuration.issuer, aud: configuration.audience, sub: 'subject-A', exp: Math.floor(Date.now()/1000)+300 });
  const token = (payload: Record<string,unknown> = {}, header: Record<string,unknown> = {}) => new SignJWT({ ...claims(), ...payload }).setProtectedHeader({ alg: 'ES256', kid: 'current', ...header }).sign(keys.privateKey);
  return { configuration, keys, jwk, response, fetcher, verifier, claims, token };
}
describe('local signed JWT session verification', () => {
  it('verifies ES256 and returns only immutable issuer/subject/expiry without token or arbitrary claims', async () => {
    const f = await fixture(), token = await f.token({ role: 'service_role', workspaceId: newId(), email: 'synthetic@fixture.invalid' });
    const session = await f.verifier.verify(`Bearer ${token}`);
    expect(session.subjectId).toBe('subject-A'); expect(Object.keys(session).sort()).toEqual(['expiresAt', 'issuer', 'subjectId']); expect(Object.isFrozen(session)).toBe(true);
    expect(f.fetcher.mock.calls[0]![0]).toBe(f.configuration.jwksUrl);
    expect(f.fetcher.mock.calls[0]![1]).toMatchObject({ method: 'GET', redirect: 'manual' });
  });
  it('verifies an explicitly configured RS256 key', async () => {
    const f = await fixture(), keys = await generateKeyPair('RS256', { extractable: true }), jwk = { ...await exportJWK(keys.publicKey), kid: 'rsa', alg: 'RS256', use: 'sig' };
    const verifier = sessionVerifier({ ...f.configuration, algorithms: ['RS256'] }, async () => new Response(JSON.stringify({ keys: [jwk] })));
    const token = await new SignJWT(f.claims()).setProtectedHeader({ alg: 'RS256', kid: 'rsa' }).sign(keys.privateKey);
    await expect(verifier.verify(`Bearer ${token}`)).resolves.toMatchObject({ subjectId: 'subject-A' });
  });
  it('rejects expired, not-yet-valid, missing expiry and blank/missing subject claims', async () => {
    const f = await fixture(), now = Math.floor(Date.now()/1000);
    for (const claims of [{ exp: now-60 }, { nbf: now+300 }, { exp: undefined }, { sub: undefined }, { sub: '   ' }]) {
      await expect(f.verifier.verify(`Bearer ${await f.token(claims)}`)).rejects.toMatchObject({ code: 'invalid_session' });
    }
  });
  it('rejects issuer/audience substitution instead of accepting any correctly signed JWT', async () => {
    const f = await fixture();
    for (const claims of [{ iss: 'https://other.fixture.invalid' }, { aud: 'other-service' }, { aud: ['other-service'] }, { iss: undefined }, { aud: undefined }]) await expect(f.verifier.verify(`Bearer ${await f.token(claims)}`)).rejects.toMatchObject({ code: 'invalid_session' });
  });
  it('rejects foreign signature and unknown key ID', async () => {
    const f = await fixture(), foreign = await fixture();
    await expect(f.verifier.verify(`Bearer ${await foreign.token()}`)).rejects.toMatchObject({ code: 'invalid_session' });
    await expect(f.verifier.verify(`Bearer ${await f.token({}, { kid: 'missing' })}`)).rejects.toMatchObject({ code: 'invalid_session' });
  });
  it('rejects symmetric/unsecured and unknown critical algorithms without a fallback', async () => {
    const f = await fixture();
    const symmetric = await new SignJWT(f.claims()).setProtectedHeader({ alg: 'HS256' }).sign(new Uint8Array(32).fill(61));
    await expect(f.verifier.verify(`Bearer ${symmetric}`)).rejects.toMatchObject({ code: 'invalid_session' });
    const payload = Buffer.from(JSON.stringify(f.claims())).toString('base64url'), unsecured = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${payload}.`;
    await expect(f.verifier.verify(`Bearer ${unsecured}`)).rejects.toMatchObject({ code: 'invalid_session' });
    const critical = await new CompactSign(Buffer.from(JSON.stringify(f.claims()))).setProtectedHeader({ alg: 'ES256', kid: 'current', crit: ['unknown'], unknown: true }).sign(f.keys.privateKey, { crit: { unknown: true } });
    await expect(f.verifier.verify(`Bearer ${critical}`)).rejects.toMatchObject({ code: 'invalid_session' });
  });
  it('rejects malformed/overlarge authorization before any JWKS request', async () => {
    const f = await fixture();
    for (const header of [undefined, '', 'Basic abc', 'Bearer x.y.', 'Bearer x.y.z, Bearer x.y.z', ' Bearer x.y.z', 'Bearer x.y.z\n', 'Bearer '+ 'a'.repeat(8200)]) await expect(f.verifier.verify(header)).rejects.toBeInstanceOf(SessionVerificationError);
    await expect(f.verifier.verify(`Bearer ${await f.token()}\n`)).rejects.toBeInstanceOf(SessionVerificationError);
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('uses the configured JWKS URL and ignores token-supplied jku/jwk sources', async () => {
    const f = await fixture(), token = await f.token({}, { jku: 'https://attacker.fixture.invalid/keys', jwk: { kty: 'oct', k: 'attacker' } });
    await expect(f.verifier.verify(`Bearer ${token}`)).resolves.toMatchObject({ subjectId: 'subject-A' });
    expect(f.fetcher).toHaveBeenCalledOnce(); expect(f.fetcher.mock.calls[0]![0]).toBe(f.configuration.jwksUrl);
  });
  it('distinguishes unavailable JWKS from invalid credentials and exposes no token/key cause', async () => {
    const f = await fixture();
    for (const fetcher of [async () => { throw Error('Private transport detail'); }, async () => new Response('unavailable', { status: 503 }), async () => new Response('{bad-json')]) {
      const verifier = sessionVerifier(f.configuration, fetcher);
      const error = await verifier.verify(`Bearer ${await f.token()}`).catch(value => value);
      expect(error).toBeInstanceOf(SessionVerificationError); expect(error.code).toBe('verification_unavailable');
      expect(error.cause).toBeUndefined(); expect(error.message).toBe('Session verification unavailable');
    }
  });
  it('requires explicit HTTPS issuer/JWKS/audience and an asymmetric allowlist', async () => {
    const f = await fixture();
    for (const configuration of [{ ...f.configuration, issuer: 'http://auth.fixture.invalid' }, { ...f.configuration, jwksUrl: 'http://auth.fixture.invalid/keys' }, { ...f.configuration, jwksUrl: 'https://user:password@auth.fixture.invalid/keys' }, { ...f.configuration, audience: '' }, { ...f.configuration, algorithms: [] }, { ...f.configuration, algorithms: ['HS256'] }, { ...f.configuration, algorithms: ['ES256','ES256'] }]) expect(() => sessionVerifier(configuration as SessionConfiguration, f.fetcher)).toThrow();
  });
  it('captures configuration before awaiting key retrieval', async () => {
    const f = await fixture(), token = await f.token(), url = f.configuration.jwksUrl;
    let release!: (value: Response) => void; f.fetcher.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const result = f.verifier.verify(`Bearer ${token}`); await vi.waitFor(() => expect(f.fetcher).toHaveBeenCalledOnce());
    f.configuration.issuer = 'https://changed.fixture.invalid'; f.configuration.audience = 'other'; f.configuration.algorithms[0] = 'RS256'; f.configuration.jwksUrl = 'https://changed.fixture.invalid/keys';
    release(f.response()); await expect(result).resolves.toMatchObject({ subjectId: 'subject-A' }); expect(f.fetcher.mock.calls[0]![0]).toBe(url);
  });
  it('does not read resource metadata before successful session verification', async () => {
    const f = await fixture(), workspaceId = newId(), pageId = newId();
    const read = vi.fn(async (_id: string, _targets: readonly ResourceReference[]): Promise<PrivateAccessSnapshot> => ({ workspace: { id: workspaceId, ownerSubjectId: 'subject-A', ownerIssuer: f.configuration.issuer }, resources: [{ type: 'page', id: pageId, workspaceId, deleted: false }] }));
    const access = authenticatedPrivateAccess(f.verifier, { read });
    await expect(access.pageDocument(undefined, workspaceId, `page:${pageId}`)).rejects.toBeInstanceOf(SessionVerificationError); expect(read).not.toHaveBeenCalled();
    await expect(access.pageDocument(`Bearer ${await f.token({ workspaceId: newId(), clientId: newId() })}`, workspaceId, `page:${pageId}`)).resolves.toMatchObject({ subjectId: 'subject-A', workspaceId });
    expect(read).toHaveBeenCalledOnce();
  });
  it('captures the requested resources while JWT key retrieval is pending', async () => {
    const f = await fixture(), workspaceId = newId(), pageId = newId(), target = { type: 'page', id: pageId };
    const read = vi.fn(async (_id: string, _targets: readonly ResourceReference[]): Promise<PrivateAccessSnapshot> => ({ workspace: { id: workspaceId, ownerSubjectId: 'subject-A', ownerIssuer: f.configuration.issuer }, resources: [{ type: 'page', id: pageId, workspaceId, deleted: false }] }));
    let release!: (value: Response) => void; f.fetcher.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const result = authenticatedPrivateAccess(f.verifier, { read }).resources(`Bearer ${await f.token()}`, workspaceId, [target]);
    await vi.waitFor(() => expect(f.fetcher).toHaveBeenCalledOnce()); target.id = newId(); release(f.response());
    await expect(result).resolves.toMatchObject({ resources: [{ type: 'page', id: pageId }] });
  });
  it('does not grant an existing owner to the same subject from another verified issuer', async () => {
    const f = await fixture(), workspaceId = newId(), issuer = 'https://other.fixture.invalid/auth/v1';
    const read = vi.fn(async (): Promise<PrivateAccessSnapshot> => ({ workspace: { id: workspaceId, ownerSubjectId: 'subject-A', ownerIssuer: f.configuration.issuer }, resources: [] }));
    const other = sessionVerifier({ ...f.configuration, issuer }, f.fetcher);
    const token = await f.token({ iss: issuer });
    await expect(other.verify(`Bearer ${token}`)).resolves.toMatchObject({ subjectId: 'subject-A', issuer });
    await expect(authenticatedPrivateAccess(other, { read }).workspace(`Bearer ${token}`, workspaceId)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  });
});
