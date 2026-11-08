-- Código de barras (EAN) de um produto que a lista já conhece: ao escanear de novo,
-- o item entra com o nome e a categoria certos. Aprendido quando alguém digita o nome
-- depois de escanear um código desconhecido.
CREATE TABLE barcodes (
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (length(code) BETWEEN 5 AND 14),
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (list_id, code)
);
