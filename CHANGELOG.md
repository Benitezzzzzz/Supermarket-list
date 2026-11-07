# Changelog

## 3.2.0 (2026-11-07)

Novo Design System "Friendly & Family", escolhido entre três propostas prototipadas.

### Design System

- Tokens únicos de cor, tipografia, espaçamento, bordas, sombras e camadas em `src/styles/tokens.css`, com tema escuro em tons quentes.
- Tipografia: Fredoka nos títulos e Atkinson Hyperlegible no texto; itens com 19px e nada abaixo de 14px.
- Cor e ícone próprios para cada categoria, com contraste mínimo de 4,5:1.
- Componentes compartilhados: painel de baixo, confirmação, aviso com Desfazer, ícones e seletor de categoria.

### Experiência no celular

- Barra inferior com Lista, Adicionar e Família; o botão de adicionar fica no alcance do polegar.
- Adicionar abre um painel que continua aberto para vários itens seguidos.
- Editar item abre um painel com quantidade e categoria em blocos grandes.
- Remover e limpar o carrinho mostram Desfazer; limpar pede confirmação antes.
- Confirmações da família no visual do app, no lugar das janelas do navegador.
- Alvos de toque de 48 a 68px e campos com 20px, para o iPhone não dar zoom.
- Respeita as áreas seguras do iPhone e acompanha o teclado virtual nos painéis.
- Esqueleto de carregamento no lugar da tela em branco, e estado de "tudo comprado".
- Indicador de sincronização: Sincronizado, Enviando ou Sem internet.

### Acessibilidade

- Categorias viraram opções de verdade (radio), com navegação pelas setas.
- Painéis prendem o foco, fecham com Esc e devolvem o foco ao sair.

### Validação

- 71 testes automáticos, lint sem erros e build limpo.
- Conferido no navegador em 390px, 320px, tema escuro e desktop: nenhum alvo de toque abaixo de 44px, nenhum campo abaixo de 16px e nenhuma rolagem horizontal.

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

### Publicado

- No ar em https://lista-do-mercado.lista-do-mercado.workers.dev, com a lista da família importada.
- Testado em produção: entrada pelo link, tempo real, quantidade, uso offline, remoção de membro, isolamento entre famílias e cabeçalhos de segurança.
- URLs de pré-visualização desligadas, para existir só a versão oficial.

### Automação

- Backup diário ligado: testado com uma execução manual, e a cópia foi descriptografada com sucesso.
- Publicação automática ligada: cada push na `main` testa e publica. Pode ser disparada também pela aba Actions.

### Ainda não verificado

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
