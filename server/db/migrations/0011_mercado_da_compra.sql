-- Mercado onde a compra foi feita, digitado ao finalizar (ou vindo do cupom).
-- Base do indicativo de preço por mercado: "R$ 6,00 no Atacadão, R$ 7,00 no Bompreço".
ALTER TABLE purchases ADD COLUMN store TEXT NOT NULL DEFAULT '';
