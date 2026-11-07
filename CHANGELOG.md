# Changelog

## 3.1.0 (2026-11-07)

Backend adaptado para o plano gratuito da Cloudflare, para publicar sem custo e sem servidor próprio.

### Alterado

- API passa a rodar em Cloudflare Workers, e o banco passa para o D1 (SQLite gerenciado). Esquema, regras e validação foram mantidos.
- Tempo real passa de SSE para WebSocket, com um Durable Object por família em hibernação.
- Aparelho removido pelo administrador é desconectado na hora, sem precisar recarregar.
- Criação de família grava direto no D1, local ou de produção.
- Tokens passam a usar a Web Crypto API.

### Adicionado

- Backup diário criptografado por GitHub Actions, além do Time Travel de 7 dias do D1.
- Publicação automática a cada push na `main`, desligada até ser configurada.
- Validação do pacote da Cloudflare no CI.

### Removido

- Servidor Node próprio, `Dockerfile` e comando de backup local, substituídos pela Cloudflare.

### Ainda não verificado

- Nada foi publicado ainda: tudo foi testado no simulador local da Cloudflare.
- Os workflows de backup e de publicação nunca rodaram.
- O app não foi testado em celular físico.

## 3.0.0 (2026-11-06)

Reescrita completa da primeira versão, que rodava como Claude Artifact.

### Adicionado

- Backend próprio em Node.js, Hono e SQLite, servindo a API e o site em um único processo.
- Frontend em React, TypeScript e Vite, instalável no celular como PWA.
- Sincronização item a item, em tempo real, sem uma pessoa apagar o trabalho da outra.
- Uso sem internet, com fila de alterações salva no aparelho.
- Entrada por link de convite, sem senha e sem precisar de conta Claude.
- Sessão por aparelho, validada no servidor, e isolamento de dados entre famílias.
- Painel Família: ver membros e, para o administrador, remover aparelhos e trocar o convite.
- Quantidade como campo próprio, lida do texto ("2 frangos") ou ajustada no lápis.
- Comandos para criar família e fazer backup.
- Testes automáticos, lint, CI e `Dockerfile`.

### Alterado

- Formulário de adicionar item reorganizado para caber melhor no celular.
- Contraste dos botões corrigido no tema escuro.
- Ícone de edição do item trocado de etiqueta para lápis.

### Migrado

- Os 17 itens e a categoria "Tese" da versão ao vivo foram para `server/seed/lista-familia.json`.

### Ainda não verificado

- O app não foi testado em HTTPS nem em celular físico.
