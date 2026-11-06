# Plano: publicação gratuita na Cloudflare

**Status:** planejado em 2026-11-06, ainda não iniciado.

## Objetivo

Publicar a Lista do Mercado sem pagar por nenhum serviço e sem hospedar nada no notebook.

## Decisão

Usar **Cloudflare Workers + D1**, com endereço `.workers.dev` e HTTPS incluídos.

Opções descartadas:

- **VPS paga:** tem custo mensal.
- **Vercel:** não mantém o SQLite nem conexões longas, e só separaria o site da API.
- **Oracle Always Free:** pede cartão, tem relatos de falta de capacidade e pode recolher máquinas com uso abaixo de 20% por 7 dias, o que é o caso de uma lista de mercado.

## Mudanças necessárias

1. Adaptar o backend Hono para rodar em Workers.
2. Trocar `node:sqlite` por D1. As consultas passam a ser assíncronas, e as transações viram `batch`.
3. Portar as migrações de `server/db/migrations` para o formato do D1.
4. Trocar `node:crypto` pela Web Crypto API.
5. Substituir o canal SSE por consulta periódica a cada poucos segundos, só com o app aberto e visível.
6. Servir o frontend pelos assets estáticos do Workers.
7. Adaptar a criação de família e a importação de `server/seed/lista-familia.json`.
8. Criar backup automático por GitHub Actions com `wrangler d1 export`. Como o repositório é público, o backup não pode ficar nele em texto aberto.
9. Remover o que deixar de ser usado, como `Dockerfile` e `.dockerignore`, e atualizar o `README.md`.

## Conferir antes de implementar

- Limites atuais na documentação oficial da Cloudflare. Os números de 100 mil requisições por dia e 10 ms de CPU vieram de fontes de terceiros.
- Se o cadastro realmente dispensa cartão.
- Se o plano grátis inclui Durable Objects. Se incluir, o tempo real instantâneo pode ser mantido.

## Limitações aceitas

- As mudanças levam alguns segundos para aparecer nos outros aparelhos.
- O app depende da Cloudflare, embora o código e os dados continuem exportáveis.
- Ao passar do limite diário, as consultas falham até o limite reiniciar. Não há cobrança, e a fila offline guarda as alterações.

## Testes após a mudança

Repetir lint, testes automáticos e o cenário de ponta a ponta com dois aparelhos no simulador local da Cloudflare, depois testar em celular físico.

## O que depende do Renan

1. Autorizar o commit da branch `refazer-app`, que ainda está sem commit.
2. Criar a conta gratuita na Cloudflare.
3. Fazer o login com `npx wrangler login`, sem compartilhar senha.
