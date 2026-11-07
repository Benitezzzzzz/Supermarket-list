-- Entrada pelo endereço do app, sem convite. O administrador pode fechar a
-- entrada depois que a família toda entrou.
ALTER TABLE families ADD COLUMN open_join INTEGER NOT NULL DEFAULT 1 CHECK (open_join IN (0, 1));
