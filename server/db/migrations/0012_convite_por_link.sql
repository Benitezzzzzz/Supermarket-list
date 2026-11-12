-- Convite por link: quem abre o link da lista entra nela como participante.
--
-- O código fica guardado como está (não como hash) porque qualquer
-- participante precisa ver o link de novo para compartilhar. Ele só dá
-- entrada na lista, e quem lê o banco já lê os dados da lista. O
-- administrador gera um código novo quando quer invalidar o antigo.
ALTER TABLE lists ADD COLUMN invite_code TEXT;
UPDATE lists SET invite_code = lower(hex(randomblob(16))) WHERE invite_code IS NULL;
CREATE UNIQUE INDEX lists_invite_code_idx ON lists (invite_code);
