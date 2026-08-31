-- Roles for the admin console. is_admin becomes a special case of role. The
-- capability map lives in the app (src/lib/capabilities.ts), not the DB.
ALTER TABLE user_approvals
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('member', 'auditor', 'ops', 'moderator', 'admin'));

-- Existing admins become role = 'admin'.
UPDATE user_approvals SET role = 'admin' WHERE is_admin = true AND role = 'member';
