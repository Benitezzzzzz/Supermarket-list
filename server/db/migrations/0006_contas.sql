-- Contas com usuário e senha, e várias listas por pessoa.
--
-- A senha nunca chega ao servidor: o aparelho deriva uma chave com PBKDF2
-- (600 mil iterações) e o servidor guarda só SHA-256(sal + chave).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(username) BETWEEN 3 AND 30),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 40),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL
);

-- Uma sessão por aparelho; o cookie guarda o token e o banco só o hash.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Quem participa de cada lista. Dados de uma lista só são lidos por quem está aqui.
CREATE TABLE list_members (
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (list_id, user_id)
);
CREATE INDEX list_members_user_idx ON list_members (user_id);

-- A lista que já existia ganha o nome Casa.
UPDATE lists SET name = 'Casa' WHERE name = 'Lista do Mercado';

-- As tabelas families e members ficam: guardam os aparelhos da versão
-- anterior, que viram contas na primeira abertura (transferência de acesso).
-- families continua como registro interno de cada lista, porque lists.family_id
-- não pode deixar de ser obrigatório sem recriar a tabela, e recriá-la
-- apagaria os itens em cascata.
