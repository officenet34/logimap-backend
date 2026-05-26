import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const ALLOWED_CATEGORIES = ['avatars', 'vehicles', 'org-logos'] as const;
export type UploadCategory = (typeof ALLOWED_CATEGORIES)[number];

export function getUploadsRoot(): string {
  const raw = process.env.UPLOAD_ROOT?.trim();
  return raw && raw.length > 0 ? raw : join(process.cwd(), 'uploads');
}

export function ensureUploadDirs(): void {
  const root = getUploadsRoot();
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  for (const cat of ALLOWED_CATEGORIES) {
    const dir = join(root, cat);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function uploadCategoryDir(category: UploadCategory): string {
  return join(getUploadsRoot(), category);
}

export function isAllowedUploadCategory(value: string): value is UploadCategory {
  return (ALLOWED_CATEGORIES as readonly string[]).includes(value);
}

export function publicApiBase(): string {
  return (
    process.env.PUBLIC_API_URL?.replace(/\/$/, '') ??
    'https://api.logimap.com.tr'
  );
}

/** Kalıcı URL — Traefik yalnızca /v1 yönlendirse bile çalışır. */
export function publicAssetUrl(
  category: UploadCategory,
  filename: string,
): string {
  return `${publicApiBase()}/v1/media/asset/${category}/${encodeURIComponent(filename)}`;
}
