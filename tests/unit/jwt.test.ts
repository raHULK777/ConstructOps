import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../../src/types/domain';
import { isAppError } from '../../src/utils/errors';
import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt';
import { createTestEnv } from '../support/testEnv';

const env = createTestEnv();

function makeUser(role: AuthUser['role'] = 'admin'): AuthUser {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    email: 'user@example.com',
    role,
  };
}

describe('access tokens', () => {
  it('round-trips the tenant, role and session claims', () => {
    const user = makeUser('field_staff');
    const sessionId = randomUUID();
    const claims = verifyAccessToken(signAccessToken(user, sessionId, env), env);

    expect(claims.sub).toBe(user.id);
    expect(claims.tenant_id).toBe(user.tenant_id);
    expect(claims.role).toBe('field_staff');
    expect(claims.email).toBe(user.email);
    expect(claims.sid).toBe(sessionId);
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('rejects a tampered signature', () => {
    const token = signAccessToken(makeUser(), randomUUID(), env);
    const tampered = `${token.slice(0, -3)}abc`;

    expect(() => verifyAccessToken(tampered, env)).toThrowError(/Access token missing or expired/);
  });

  it('rejects tokens issued for another audience or issuer', () => {
    const user = makeUser();
    const foreign = jwt.sign(
      { tenant_id: user.tenant_id, role: 'admin', email: user.email, sid: randomUUID() },
      env.jwtSecret,
      { algorithm: 'HS256', subject: user.id, issuer: 'someone-else', audience: env.jwtAudience },
    );

    expect(() => verifyAccessToken(foreign, env)).toThrowError(/Access token missing or expired/);
  });

  it('rejects tokens without a session claim', () => {
    const user = makeUser();
    const noSession = jwt.sign(
      { tenant_id: user.tenant_id, role: 'admin', email: user.email },
      env.jwtSecret,
      {
        algorithm: 'HS256',
        subject: user.id,
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
        expiresIn: '1h',
      },
    );

    expect(() => verifyAccessToken(noSession, env)).toThrowError(/Access token missing or expired/);
  });

  it('rejects expired tokens', () => {
    const user = makeUser();
    const expired = jwt.sign(
      { tenant_id: user.tenant_id, role: 'admin', email: user.email, sid: randomUUID() },
      env.jwtSecret,
      {
        algorithm: 'HS256',
        subject: user.id,
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
        expiresIn: -10,
      },
    );

    expect(() => verifyAccessToken(expired, env)).toThrowError(/Access token missing or expired/);
  });

  it('rejects unsigned ("alg: none") tokens', () => {
    const user = makeUser();
    const unsigned = jwt.sign(
      { tenant_id: user.tenant_id, role: 'admin', email: user.email, sid: randomUUID() },
      '',
      { algorithm: 'none', subject: user.id, issuer: env.jwtIssuer, audience: env.jwtAudience },
    );

    expect(() => verifyAccessToken(unsigned, env)).toThrowError(/Access token missing or expired/);
  });

  it('surfaces the failure as a 401 AppError', () => {
    try {
      verifyAccessToken('not-a-token', env);
      expect.unreachable('verification should have thrown');
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      if (isAppError(error)) {
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('UNAUTHORIZED');
      }
    }
  });
});
