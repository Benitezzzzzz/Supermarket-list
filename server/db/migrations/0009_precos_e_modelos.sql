-- Modelos de lista (listas padrão reutilizáveis). Os itens ficam em JSON: o modelo
-- é editado inteiro de uma vez e nunca é consultado item a item.
CREATE TABLE templates (
  list_id TEXT NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (list_id, id)
);
-- No máximo um modelo padrão por lista.
CREATE UNIQUE INDEX templates_default_idx ON templates (list_id) WHERE is_default = 1;

-- Preço e marca de cada item ficam dentro de purchases.items (JSON), que já existe:
-- não há coluna nova. O total por mês usa o índice purchases_recent_idx.
