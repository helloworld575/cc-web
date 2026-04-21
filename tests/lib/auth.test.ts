import { describe, expect, it } from 'vitest';
import { isWeakAdminPassword, verifyAdminPassword } from '@/lib/auth';

describe('lib/auth', () => {
  it('flags missing and default admin passwords as weak', () => {
    expect(isWeakAdminPassword(undefined)).toBe(true);
    expect(isWeakAdminPassword('')).toBe(true);
    expect(isWeakAdminPassword('changeme')).toBe(true);
    expect(isWeakAdminPassword('correct horse battery staple')).toBe(false);
  });

  it('verifies passwords with constant-time comparison semantics', () => {
    expect(verifyAdminPassword('secret-123', 'secret-123')).toBe(true);
    expect(verifyAdminPassword('secret-123', 'secret-124')).toBe(false);
    expect(verifyAdminPassword('short', 'much-longer')).toBe(false);
    expect(verifyAdminPassword(undefined, 'secret-123')).toBe(false);
  });
});
