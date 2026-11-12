-- Quantidade escrita no fim do nome ("Peixe 1", "Café 2", "Ovos - 12") sai do nome
-- e vira a quantidade, como o app passa a fazer ao adicionar e colar.
-- Só mexe quando sobra no nome algo além de números e sinais (uma letra).
-- Se a quantidade já tinha sido ajustada (mais de 1), ela fica; o número só sai do nome.

UPDATE items SET
  quantity = CASE WHEN quantity = 1 THEN CAST(substr(text, -3) AS INTEGER) ELSE quantity END,
  text = rtrim(rtrim(substr(text, 1, length(text) - 3)), ' -–')
WHERE text GLOB '* [0-9][0-9][0-9]'
  AND CAST(substr(text, -3) AS INTEGER) BETWEEN 1 AND 999
  AND rtrim(rtrim(substr(text, 1, length(text) - 3)), ' -–') GLOB '*[^-0-9 .,/%()+]*';

UPDATE items SET
  quantity = CASE WHEN quantity = 1 THEN CAST(substr(text, -2) AS INTEGER) ELSE quantity END,
  text = rtrim(rtrim(substr(text, 1, length(text) - 2)), ' -–')
WHERE text GLOB '* [0-9][0-9]'
  AND CAST(substr(text, -2) AS INTEGER) BETWEEN 1 AND 999
  AND rtrim(rtrim(substr(text, 1, length(text) - 2)), ' -–') GLOB '*[^-0-9 .,/%()+]*';

UPDATE items SET
  quantity = CASE WHEN quantity = 1 THEN CAST(substr(text, -1) AS INTEGER) ELSE quantity END,
  text = rtrim(rtrim(substr(text, 1, length(text) - 1)), ' -–')
WHERE text GLOB '* [0-9]'
  AND CAST(substr(text, -1) AS INTEGER) BETWEEN 1 AND 999
  AND rtrim(rtrim(substr(text, 1, length(text) - 1)), ' -–') GLOB '*[^-0-9 .,/%()+]*';
