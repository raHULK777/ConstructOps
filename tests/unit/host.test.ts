import { describe, expect, it } from 'vitest';
import {
  normalizeHost,
  subdomainCandidate,
  tenantCacheKey,
  tenantCacheKeys,
} from '../../src/utils/host';

describe('normalizeHost', () => {
  it('lowercases, strips the port and strips a leading www label', () => {
    expect(normalizeHost('Alpha.ConstructOps.test:3000')).toBe('alpha.constructops.test');
    expect(normalizeHost('www.Alpha.ConstructOps.test')).toBe('alpha.constructops.test');
    expect(normalizeHost('alpha.constructops.test.')).toBe('alpha.constructops.test');
  });

  it('rejects IP literals, single-label hosts and malformed names', () => {
    expect(normalizeHost('127.0.0.1:3000')).toBeNull();
    expect(normalizeHost('127.0.0.1')).toBeNull();
    expect(normalizeHost('[::1]:3000')).toBeNull();
    expect(normalizeHost('localhost')).toBeNull();
    expect(normalizeHost('bad host.com')).toBeNull();
    expect(normalizeHost('alpha..example.com')).toBeNull();
    expect(normalizeHost(undefined)).toBeNull();
    expect(normalizeHost('   ')).toBeNull();
  });

  it('rejects hosts longer than 253 characters', () => {
    expect(normalizeHost(`${'a'.repeat(250)}.com`)).toBeNull();
  });
});

describe('subdomainCandidate', () => {
  it('extracts the label(s) below the platform root domain', () => {
    expect(subdomainCandidate('alpha.constructops.test', 'constructops.test')).toBe('alpha');
    expect(subdomainCandidate('deep.sub.constructops.test', 'constructops.test')).toBe('deep.sub');
  });

  it('never guesses a subdomain for hosts outside the root domain', () => {
    // A custom domain must not be able to collide with another tenant's subdomain.
    expect(subdomainCandidate('alpha-builders.example.com', 'constructops.test')).toBeNull();
    expect(subdomainCandidate('acme.com', null)).toBeNull();
    expect(subdomainCandidate('constructops.test', 'constructops.test')).toBeNull();
  });

  it('rejects candidates that exceed the subdomain column width', () => {
    expect(subdomainCandidate(`${'a'.repeat(101)}.constructops.test`, 'constructops.test')).toBeNull();
  });
});

describe('tenant cache keys', () => {
  it('derives the www variant for invalidation', () => {
    expect(tenantCacheKey('alpha.constructops.test')).toBe('tenant:v1:alpha.constructops.test');
    expect(tenantCacheKeys('alpha.constructops.test')).toEqual([
      'tenant:v1:alpha.constructops.test',
      'tenant:v1:www.alpha.constructops.test',
    ]);
  });

  it('does not double-prefix www', () => {
    expect(tenantCacheKeys('www.alpha.constructops.test')).toEqual([
      'tenant:v1:www.alpha.constructops.test',
    ]);
  });
});
