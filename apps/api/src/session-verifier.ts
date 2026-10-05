import { createRemoteJWKSet, customFetch, jwtVerify, errors } from 'jose';
import { subjectIdSchema } from '@greiva/domain';

export type SessionConfiguration = Readonly<{ issuer: string; audience: string; jwksUrl: string; algorithms: readonly ('ES256' | 'RS256')[] }>;
export type VerifiedSession = Readonly<{ subjectId: string; issuer: string; expiresAt: number }>;
export interface SessionVerifier { verify(authorization: unknown): Promise<VerifiedSession>; }
export class SessionVerificationError extends Error {
  constructor(readonly code: 'invalid_session' | 'verification_unavailable') {
    super(code === 'invalid_session' ? 'Invalid session' : 'Session verification unavailable'); this.name = 'SessionVerificationError';
  }
}
function secureUrl(value: string) {
  const url = new URL(value);
  if (value !== value.trim() || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Auth endpoint requires an explicit HTTPS URL without credentials/query/fragment');
  return url;
}
// The optional fetch port is trusted server infrastructure, not request data.
// Tests provide public fixture JWKS. Production uses normal HTTPS fetch.
export function sessionVerifier(configuration: SessionConfiguration, fetchJwks?: typeof globalThis.fetch): SessionVerifier {
  const issuer = configuration.issuer, audience = configuration.audience;
  secureUrl(issuer); const url = secureUrl(configuration.jwksUrl);
  if (typeof audience !== 'string' || !audience.trim()) throw new Error('Auth audience is required');
  if (!Array.isArray(configuration.algorithms) || !configuration.algorithms.length || configuration.algorithms.length > 2
    || configuration.algorithms.some(value => value !== 'ES256' && value !== 'RS256') || new Set(configuration.algorithms).size !== configuration.algorithms.length) throw new Error('Explicit asymmetric Auth algorithms are required');
  const algorithms = Object.freeze([...configuration.algorithms]);
  const getKey = createRemoteJWKSet(url, fetchJwks ? { [customFetch]: fetchJwks } : {});
  return Object.freeze({
    async verify(authorization: unknown): Promise<VerifiedSession> {
      if (typeof authorization !== 'string' || authorization.length > 8199) throw new SessionVerificationError('invalid_session');
      const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
      if (!match || match[0] !== authorization) throw new SessionVerificationError('invalid_session');
      try {
        const { payload } = await jwtVerify(match[1]!, getKey, { issuer, audience, algorithms: [...algorithms], requiredClaims: ['sub', 'exp'], clockTolerance: 0 });
        const subject = subjectIdSchema.safeParse(payload.sub);
        if (!subject.success || !Number.isSafeInteger(payload.exp)) throw new SessionVerificationError('invalid_session');
        // Do not expose the raw token, role, arbitrary claims or auth key material.
        return Object.freeze({ subjectId: subject.data, issuer, expiresAt: payload.exp! });
      } catch (error) {
        if (error instanceof SessionVerificationError) throw error;
        const invalid = error instanceof errors.JOSEAlgNotAllowed || error instanceof errors.JOSENotSupported || error instanceof errors.JWSInvalid
          || error instanceof errors.JWSSignatureVerificationFailed || error instanceof errors.JWTInvalid
          || error instanceof errors.JWTClaimValidationFailed || error instanceof errors.JWTExpired
          || error instanceof errors.JWKSNoMatchingKey;
        // Library causes can contain token claims. Return only the safe category.
        throw new SessionVerificationError(invalid ? 'invalid_session' : 'verification_unavailable');
      }
    },
  });
}
