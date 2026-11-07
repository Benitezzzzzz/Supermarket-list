-- Administrador geral: vê todas as contas e listas, abre qualquer lista e
-- redefine senhas. Só é dado pelo comando user:set-superadmin, nunca pela API.
ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0 CHECK (is_superadmin IN (0, 1));
