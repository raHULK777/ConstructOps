import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string, rounds: number): Promise<string> {
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

let dummyHash: string | null = null;

/**
 * Burns comparable CPU time when the account does not exist, so response timing
 * does not reveal whether an email is registered on this tenant.
 */
export async function verifyAgainstDummyHash(plain: string): Promise<void> {
  dummyHash ??= await bcrypt.hash('constructops-timing-equalizer', 10);
  await bcrypt.compare(plain, dummyHash);
}
