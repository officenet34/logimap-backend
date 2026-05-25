-- LogiMap: kullanıcı üye kodu (7 rakam) + işletme kodu (S/F + 7 rakam)
-- Idempotent: birden fazla çalıştırılabilir.

-- ─── Kullanıcı: member_code ───────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS member_code CHAR(7);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_member_code_key'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_member_code_key;
  END IF;
END $$;

-- Eski 12 karakterli veya text tipinden 7 karaktere geçiş
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'member_code'
      AND (
        data_type <> 'character'
        OR character_maximum_length IS DISTINCT FROM 7
      )
  ) THEN
    ALTER TABLE public.users
      ALTER COLUMN member_code TYPE CHAR(7) USING (
        CASE
          WHEN member_code IS NULL THEN NULL
          WHEN length(regexp_replace(member_code::text, '\D', '', 'g')) >= 7 THEN
            lpad(substr(regexp_replace(member_code::text, '\D', '', 'g'), 1, 7), 7, '0')
          ELSE lpad((floor(random() * 9000000) + 1000000)::text, 7, '0')
        END
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_logimap_user_member_code()
RETURNS CHAR(7)
LANGUAGE plpgsql
AS $$
DECLARE
  code CHAR(7);
  tries INT := 0;
BEGIN
  LOOP
    code := lpad((floor(random() * 9000000) + 1000000)::text, 7, '0');
    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.member_code = code) THEN
      RETURN code;
    END IF;
    tries := tries + 1;
    IF tries > 50 THEN
      RAISE EXCEPTION 'user member_code üretilemedi';
    END IF;
  END LOOP;
END;
$$;

UPDATE public.users
SET member_code = public.generate_logimap_user_member_code()
WHERE member_code IS NULL
   OR btrim(member_code::text) = ''
   OR length(btrim(member_code::text)) <> 7;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_member_code_key'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_member_code_key UNIQUE (member_code);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_users_member_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  code CHAR(7);
  tries INT := 0;
BEGIN
  IF NEW.member_code IS NOT NULL AND length(btrim(NEW.member_code::text)) = 7 THEN
    NEW.member_code := btrim(NEW.member_code::text);
    RETURN NEW;
  END IF;
  LOOP
    code := public.generate_logimap_user_member_code();
    BEGIN
      NEW.member_code := code;
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 50 THEN
        RAISE EXCEPTION 'user member_code üretilemedi';
      END IF;
    END;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS set_users_member_code ON public.users;
CREATE TRIGGER set_users_member_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_users_member_code();

CREATE INDEX IF NOT EXISTS idx_users_member_code ON public.users (member_code);

-- ─── İşletme: org_code (S+7 / F+7) ───────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS org_code CHAR(8);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.organizations'::regclass
      AND conname = 'organizations_org_code_key'
  ) THEN
    ALTER TABLE public.organizations DROP CONSTRAINT organizations_org_code_key;
  END IF;
END $$;

-- ADD COLUMN ... UNIQUE ile oluşmuş otomatik constraint adı farklı olabilir
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE t.relname = 'organizations'
      AND a.attname = 'org_code'
      AND c.contype = 'u'
      AND c.conname <> 'organizations_org_code_key'
  LOOP
    EXECUTE format('ALTER TABLE public.organizations DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.generate_logimap_org_code(p_prefix CHAR(1))
RETURNS CHAR(8)
LANGUAGE plpgsql
AS $$
DECLARE
  code CHAR(8);
  tries INT := 0;
BEGIN
  IF p_prefix NOT IN ('S', 'F') THEN
    RAISE EXCEPTION 'org_code prefix S veya F olmalı';
  END IF;
  LOOP
    code := p_prefix || lpad((floor(random() * 9000000) + 1000000)::text, 7, '0');
    IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.org_code = code) THEN
      RETURN code;
    END IF;
    tries := tries + 1;
    IF tries > 50 THEN
      RAISE EXCEPTION 'org_code üretilemedi';
    END IF;
  END LOOP;
END;
$$;

UPDATE public.organizations o
SET org_code = public.generate_logimap_org_code(
  CASE WHEN o.org_type::text = 'sole_proprietor' THEN 'S' ELSE 'F' END
)
WHERE org_code IS NULL OR btrim(org_code::text) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.organizations'::regclass
      AND conname = 'organizations_org_code_key'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_org_code_key UNIQUE (org_code);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_organizations_org_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prefix CHAR(1);
  code CHAR(8);
  tries INT := 0;
BEGIN
  IF NEW.org_code IS NOT NULL AND length(btrim(NEW.org_code::text)) = 8 THEN
    NEW.org_code := upper(btrim(NEW.org_code::text));
    RETURN NEW;
  END IF;
  prefix := CASE WHEN NEW.org_type::text = 'sole_proprietor' THEN 'S' ELSE 'F' END;
  LOOP
    code := public.generate_logimap_org_code(prefix);
    BEGIN
      NEW.org_code := code;
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 50 THEN
        RAISE EXCEPTION 'org_code üretilemedi';
      END IF;
    END;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS set_organizations_org_code ON public.organizations;
CREATE TRIGGER set_organizations_org_code
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_organizations_org_code();

CREATE INDEX IF NOT EXISTS idx_organizations_org_code ON public.organizations (org_code);
