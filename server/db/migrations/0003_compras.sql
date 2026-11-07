-- Compras finalizadas: valor e forma de pagamento, para a aba Gastos.
-- O valor fica em centavos (inteiro) para não haver erro de arredondamento.
CREATE TABLE purchases (
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000),
  method TEXT NOT NULL CHECK (method IN ('pix', 'debito', 'credito')),
  installments INTEGER NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 24),
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  member_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (list_id, id),
  -- Só o crédito pode ser parcelado.
  CHECK (method = 'credito' OR installments = 1)
);
CREATE INDEX purchases_recent_idx ON purchases (list_id, created_at);
