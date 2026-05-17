/** Türkiye GSM → E.164 (+905xxxxxxxxx) */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');

  // +900532… / +900000… (hatalı birleşim: 90 + 0 + 10 hane) → 90532…
  if (digits.startsWith('900') && digits.length === 13) {
    digits = `90${digits.substring(3)}`;
  }
  if (digits.startsWith('900') && digits.length === 12) {
    digits = `90${digits.substring(2)}`;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    digits = `90${digits.substring(1)}`;
  }

  if (digits.startsWith('90') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.length === 10 && digits.startsWith('5')) {
    return `+90${digits}`;
  }

  if (trimmed.startsWith('+')) {
    if (digits.startsWith('90') && digits.length === 12) {
      return `+${digits}`;
    }
    if (digits.length === 10 && digits.startsWith('5')) {
      return `+90${digits}`;
    }
    return `+${digits}`;
  }

  throw new Error('Geçersiz telefon numarası');
}

/** Girişte eski hatalı kayıtlar (+9005…) için alternatifler */
export function phoneLookupValues(input: string): string[] {
  const values = new Set<string>();
  try {
    const normalized = normalizePhone(input);
    values.add(normalized);
    const m = normalized.match(/^\+90(\d{10})$/);
    if (m) {
      values.add(`+900${m[1]}`);
    }
  } catch {
    const digits = input.replace(/\D/g, '');
    if (digits.length >= 10) {
      values.add(input.trim());
    }
  }
  return [...values];
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(phone);
}
