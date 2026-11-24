-- Read-only demonstration accounts.
--
-- Additive only. One NOT NULL column on public.users with a FALSE default, so
-- every existing account keeps exactly the access it has today. No existing row
-- is rewritten and no existing column, constraint or index is modified. The
-- runner owns the transaction and sets lock_timeout=5s / statement_timeout=60s.
--
-- WHY. The public demo publishes one sign-in so that anyone can look around a
-- fully populated company. That account has to see what an administrator sees,
-- or the demo hides most of the product, and it must not be able to change
-- anything, or the first visitor decides what the next one sees. A role cannot
-- say both: admin grants the writes, and employee hides the screens. So the
-- account keeps the admin role, and this column takes the writes away.
--
-- WHERE IT IS ENFORCED. The API reads the column on every request, in the same
-- session lookup that reads the role, and refuses every request that is not a
-- read before any route runs, apart from a short allowlist that changes nothing
-- but the account's own read markers. A route added later is covered without
-- anyone remembering to cover it. The interface only explains the refusal.
--
-- WHAT IT IS NOT. It is not a role and is not read by any visibility rule: a
-- read-only account sees exactly what its role allows, no more and no less.

DO $preflight$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Expected users table is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.users'::regclass
      AND attname = 'demo_read_only' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'users.demo_read_only already exists; review before applying 0023';
  END IF;
END
$preflight$;

ALTER TABLE public.users
  ADD COLUMN demo_read_only BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.demo_read_only IS
  'TRUE for a published demonstration sign-in. The API refuses every write from '
  'such an account (settings, users, deletions and every other change) apart '
  'from marking its own notifications and announcements read and signing out. '
  'It never widens '
  'what the account can see; that is still decided by its role.';
