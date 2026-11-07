-- Adiciona dinheiro (espécie) às formas de pagamento.
-- O SQLite não altera a regra CHECK de uma tabela existente, então ela é
-- recriada e todas as compras já registradas são copiadas.
PRAGMA defer_foreign_keys = true;

CREATE TABLE purchases_new (
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000),
  method TEXT NOT NULL CHECK (method IN ('pix', 'dinheiro', 'debito', 'credito')),
  installments INTEGER NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 24),
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  member_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (list_id, id),
  -- Só o crédito pode ser parcelado.
  CHECK (method = 'credito' OR installments = 1)
);

INSERT INTO purchases_new
  (list_id, id, amount_cents, method, installments, item_count, member_name, created_at)
SELECT list_id, id, amount_cents, method, installments, item_count, member_name, created_at
FROM purchases;

DROP TABLE purchases;
ALTER TABLE purchases_new RENAME TO purchases;
CREATE INDEX purchases_recent_idx ON purchases (list_id, created_at);
