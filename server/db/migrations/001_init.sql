-- Cada família é isolada: toda consulta de dados parte da família do membro logado.
-- Convites e sessões são guardados só como hash SHA-256; o valor real nunca fica no banco.

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  session_hash TEXT NOT NULL UNIQUE,
  joined_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX members_family_idx ON members (family_id);

-- Hoje cada família tem uma lista; a tabela já permite várias no futuro.
CREATE TABLE lists (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX lists_family_idx ON lists (family_id);

-- A chave inclui list_id: um id enviado por outra família nunca alcança esta linha.
CREATE TABLE items (
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 80),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 40),
  created_at TEXT NOT NULL,
  PRIMARY KEY (list_id, id)
);

CREATE TABLE categories (
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 40),
  created_at TEXT NOT NULL,
  PRIMARY KEY (list_id, name)
);
