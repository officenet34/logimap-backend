const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    console.error('❌ Eksik ortam değişkenleri (Coolify → Environment Variables):');
    for (const key of missing) {
      console.error(`   - ${key}`);
    }
    console.error('');
    console.error('Örnek:');
    console.error('  DATABASE_URL=postgresql://logimap_app:SIFRE@postgres:5432/logimap_db');
    console.error('  JWT_ACCESS_SECRET=<openssl rand -hex 32>');
    console.error('  JWT_REFRESH_SECRET=<openssl rand -hex 32>');
    process.exit(1);
  }
}
