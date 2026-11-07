-- Guarda, em cada compra, a lista do que estava nela (JSON), para aparecer em Gastos.
-- Compras feitas antes desta versão ficam com a lista vazia.
ALTER TABLE purchases ADD COLUMN items TEXT NOT NULL DEFAULT '[]';

-- Excluir só marca a compra; assim o Desfazer devolve tudo exatamente como era.
ALTER TABLE purchases ADD COLUMN deleted_at TEXT;
