-- Cupom fiscal (NFC-e) ligado a uma compra, lido pela foto ou pelo QR code.
-- A foto não é guardada; ficam a loja, a chave de acesso e as linhas do cupom.
CREATE TABLE receipts (
  list_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  access_key TEXT CHECK (access_key IS NULL OR length(access_key) = 44),
  store_name TEXT NOT NULL DEFAULT '',
  cnpj TEXT CHECK (cnpj IS NULL OR length(cnpj) = 14),
  issued_on TEXT,
  total_cents INTEGER CHECK (total_cents IS NULL OR total_cents >= 0),
  source TEXT NOT NULL CHECK (source IN ('foto', 'qrcode')),
  read_at TEXT NOT NULL,
  PRIMARY KEY (list_id, purchase_id),
  FOREIGN KEY (list_id, purchase_id) REFERENCES purchases (list_id, id) ON DELETE CASCADE
);
-- O mesmo cupom não entra em duas compras da mesma lista.
CREATE UNIQUE INDEX receipts_access_key_idx ON receipts (list_id, access_key) WHERE access_key IS NOT NULL;

-- Cada linha do cupom e, quando houver, o item da lista da compra a que corresponde
-- (list_index aponta para a posição em purchases.items).
CREATE TABLE receipt_items (
  list_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT '',
  unit_cents INTEGER NOT NULL CHECK (unit_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  list_index INTEGER CHECK (list_index IS NULL OR list_index >= 0),
  PRIMARY KEY (list_id, purchase_id, position),
  FOREIGN KEY (list_id, purchase_id) REFERENCES receipts (list_id, purchase_id) ON DELETE CASCADE
);
-- Base para o histórico de preços e o leitor de código de barras.
CREATE INDEX receipt_items_code_idx ON receipt_items (code) WHERE code <> '';

-- Quantas leituras de foto cada lista fez no dia, para não esgotar a cota grátis da IA.
CREATE TABLE receipt_reads (
  day TEXT NOT NULL,
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, list_id)
);
