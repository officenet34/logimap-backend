import { OrganizationType } from '@prisma/client';

/** Kullanıcı üye kodu: 7 haneli rakam (ör. 2321560). */
export function generateUserMemberCode(): string {
  const num = 1_000_000 + Math.floor(Math.random() * 9_000_000);
  return String(num);
}

/** İşletme kodu: Şahıs S+7 rakam, Şirket F+7 rakam (ör. S2321560, F1561360). */
export function generateOrgCode(orgType: OrganizationType): string {
  const prefix = orgType === OrganizationType.sole_proprietor ? 'S' : 'F';
  const num = 1_000_000 + Math.floor(Math.random() * 9_000_000);
  return `${prefix}${num}`;
}

/** Davet / QR girişinden kullanıcı üye kodunu çıkar (yalnızca 7 rakam). */
export function normalizeUserMemberCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  const uriMatch = /(?:logimap:\/\/)?invite\?code=([A-Z0-9]+)/i.exec(trimmed);
  let token = uriMatch?.[1] ?? trimmed;
  const tokenMatch = /token=([A-Z0-9]+)/i.exec(token);
  if (tokenMatch?.[1]) token = tokenMatch[1];
  const digits = token.replace(/\D/g, '');
  if (digits.length === 7) return digits;
  if (digits.length > 7) return digits.slice(0, 7);
  return digits;
}

export function isValidUserMemberCode(code: string): boolean {
  return /^\d{7}$/.test(code);
}

export function isValidOrgCode(code: string): boolean {
  return /^[SF]\d{7}$/.test(code);
}
