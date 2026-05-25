-- LogiMap VDS: işletme daveti düzeltmeleri + uygulama bildirimleri (Family247 notifications karşılığı)
-- Idempotent.

-- 1) Personel (manager) daveti engelleyen eski CHECK kaldır
ALTER TABLE public.organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_driver_role_chk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.organization_invitations'::regclass
      AND conname = 'organization_invitations_role_chk'
  ) THEN
    ALTER TABLE public.organization_invitations
      ADD CONSTRAINT organization_invitations_role_chk
      CHECK (invite_role IN ('driver', 'manager'));
  END IF;
END $$;

-- 2) Uygulama bildirimleri (Supabase notifications yerine — LogiMap API)
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON public.app_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread
  ON public.app_notifications (user_id, is_read)
  WHERE is_read = false;

COMMENT ON TABLE public.app_notifications IS
  'LogiMap in-app bildirimler (org_invite, org_invite_sent, org_invite_accepted, ...)';
