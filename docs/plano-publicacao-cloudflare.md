# Plano: publicação gratuita na Cloudflare

**Status:** publicado em 2026-11-07 em https://lista-do-mercado.lista-do-mercado.workers.dev.

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
5. Substituir o canal SSE por WebSocket com Durable Objects, que a documentação oficial confirmou estarem no plano grátis.
6. Servir o frontend pelos assets estáticos do Workers.
7. Adaptar a criação de família e a importação de `server/seed/lista-familia.json`.
8. Criar backup automático por GitHub Actions com `wrangler d1 export`. Como o repositório é público, o backup não pode ficar nele em texto aberto.
9. Remover o que deixar de ser usado, como `Dockerfile` e `.dockerignore`, e atualizar o `README.md`.

## Conferido na documentação oficial (2026-11-07)

- Workers: 100 mil requisições por dia e 10 ms de CPU por chamada; arquivos estáticos não contam.
- D1: 5 milhões de leituras e 100 mil escritas por dia, 500 MB por banco, Time Travel de 7 dias.
- Durable Objects: disponíveis no plano grátis, só com SQLite; 100 mil requisições e 13.000 GB-s por dia; hibernação não consome tempo.
- Ao passar de um limite, a chamada falha. Nenhuma página fala em cobrança.
- Nenhuma página diz se o cadastro pede cartão.

## Limitações aceitas

- O app depende da Cloudflare, embora o código e os dados continuem exportáveis.
- Ao passar do limite diário, as consultas falham até o limite reiniciar. Não há cobrança, e a fila offline guarda as alterações.

## Testes após a mudança

Repetir lint, testes automáticos e o cenário de ponta a ponta com dois aparelhos no simulador local da Cloudflare, depois testar em celular físico.

## Pendências

- Configurar os segredos do GitHub para o backup diário e a publicação automática (ver README).
- Testar em celular físico.
