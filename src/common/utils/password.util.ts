import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const PIN_REGEX = /^\d{6}$/;

export function assertSixDigitPin(password: string): void {
  if (!PIN_REGEX.test(password)) {
    throw new Error('Şifre tam 6 haneli sayı olmalıdır');
  }
}

export async function hashPin(password: string): Promise<string> {
  assertSixDigitPin(password);
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPin(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
