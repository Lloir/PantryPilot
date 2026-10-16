import crypto from 'node:crypto';

const SCRYPT_COST = 16_384;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_COST = 65_536;
const LEGACY_VERIFY_SALT = crypto.randomBytes(16);

export function isPasswordHash(value: string): boolean {
  return value.startsWith('scrypt$');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, { N: SCRYPT_COST });
  return `scrypt$${SCRYPT_COST}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!isPasswordHash(stored)) {
    const actual = crypto.scryptSync(password, LEGACY_VERIFY_SALT, SCRYPT_KEY_LENGTH, { N: SCRYPT_COST });
    const expected = crypto.scryptSync(stored, LEGACY_VERIFY_SALT, SCRYPT_KEY_LENGTH, { N: SCRYPT_COST });
    return crypto.timingSafeEqual(actual, expected);
  }

  const match = stored.match(/^scrypt\$(\d+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  const cost = Number(match[1]);
  const salt = Buffer.from(match[2], 'base64');
  const expected = Buffer.from(match[3], 'base64');
  if (
    !Number.isSafeInteger(cost) ||
    cost < 1_024 ||
    cost > SCRYPT_MAX_COST ||
    (cost & (cost - 1)) !== 0 ||
    salt.length !== 16 ||
    salt.toString('base64') !== match[2] ||
    expected.length !== SCRYPT_KEY_LENGTH ||
    expected.toString('base64') !== match[3]
  ) return false;

  const actual = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: cost,
    maxmem: 128 * cost * 8 + 1024 * 1024,
  });
  return crypto.timingSafeEqual(actual, expected);
}
