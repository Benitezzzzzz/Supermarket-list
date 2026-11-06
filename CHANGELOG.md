# Changelog

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

- O `Dockerfile` e o workflow de CI nunca foram executados.
- O app não foi testado em HTTPS nem em celular físico.

## Próximos passos

Publicar de graça em Cloudflare Workers + D1. O plano está em [docs/plano-publicacao-cloudflare.md](docs/plano-publicacao-cloudflare.md).
