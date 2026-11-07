# Changelog

## 4.0.0 (2026-11-07)

Contas com usuário e senha, e várias listas por pessoa.

### Adicionado

- **Contas:** criar conta, entrar, sair e trocar senha. A senha é derivada no aparelho (PBKDF2, 600 mil iterações) e nunca chega ao servidor; 5 tentativas erradas bloqueiam a conta por 15 minutos.
- **Várias listas:** cada pessoa pode criar e participar de várias listas, como Casa e Pousada. Troca tocando no nome da lista no topo.
- **Participantes por lista:** quem administra adiciona pelo usuário, remove, renomeia e exclui a lista; quem participa pode sair.
- **Gastos separados por lista.**
- **Transferência automática:** aparelhos da versão anterior, na primeira abertura, criam usuário e senha e levam a lista com itens e gastos.
- Comando `npm run user:reset-password` para redefinir a senha de quem esqueceu.
- Botão "Sua conta" no topo da lista.
- Na tela de transferência, "Já criei minha conta em outro aparelho" leva direto ao Entrar.

### Alterado

- Finalizar e Adicionar ficam lado a lado numa barra fixa acima do menu, sempre visíveis. Antes o botão flutuante podia cobrir o Finalizar em listas curtas.
- A lista que já existia passou a se chamar Casa.
- A API passa a ser por lista: `/api/lists/:id/...`.

### Removido

- Entrada só pelo nome e o botão de fechar a entrada, substituídos pelas contas.
- O comando `family:create` e o arquivo de importação inicial, que não são mais necessários.

### Banco de dados

- Migração `0006_contas.sql`: tabelas `users`, `sessions` e `list_members`. As tabelas antigas continuam para a transferência dos aparelhos.

## 3.8.0 (2026-11-07)

### Alterado

- Item marcado como comprado continua na mesma categoria e na mesma posição, só riscado. A seção separada "No carrinho" foi removida.
- Categoria com todos os itens comprados mostra um sinal de concluído no lugar da contagem.
- A lixeira do topo agora pergunta o que limpar: só os itens riscados ou a lista toda. É onde ficou o antigo "Limpar comprados".

## 3.7.0 (2026-11-07)

### Adicionado

- **Itens da compra em Gastos:** cada compra guarda a lista que estava nela. Em Gastos, "Ver os N itens" mostra os comprados e os que ficaram sem marcar, com a quantidade. Compras anteriores a esta versão não têm a lista.
- **Excluir compra:** no painel de corrigir, com confirmação e Desfazer. A compra é só marcada como excluída, então o Desfazer a devolve exatamente como era.

### Banco de dados

- Migração `0005_itens_da_compra.sql`: colunas `items` e `deleted_at` em `purchases`. Testada com dados existentes.

## 3.6.0 (2026-11-07)

### Adicionado

- **Corrigir compra:** em Gastos, cada compra tem o botão Corrigir para mudar o valor ou a forma de pagamento. Funciona sem internet, pela mesma fila.
- **Dinheiro (espécie)** como forma de pagamento, sem parcelamento.

### Banco de dados

- Migração `0004_dinheiro.sql` recria a tabela de compras para aceitar a nova forma de pagamento, copiando as compras existentes. Testada com dados antes de publicar.

## 3.5.0 (2026-11-07)

### Adicionado

- **Finalizar compra:** botão no fim da lista. Pede o valor e a forma de pagamento (PIX, débito ou crédito); no crédito, se foi à vista ou parcelado, e em quantas vezes (até 24).
- Depois pergunta **"Finalizar lista?"**. No Sim, a compra é guardada e a lista inteira é limpa.
- **Aba Gastos:** últimas 50 compras com valor, forma de pagamento, data, quantidade de itens e quem registrou, e o total do mês.
- Finalizar funciona sem internet: entra na fila e é enviado quando a conexão volta, sem duplicar a compra nem apagar itens adicionados depois.

### Alterado

- A barra de baixo passa a ter Lista, Gastos e Participantes. Adicionar virou um botão flutuante no canto da tela da lista.

## 3.4.1 (2026-11-07)

### Alterado

- A aba Família passa a se chamar Participantes, na barra de baixo, no título e nas mensagens.

## 3.4.0 (2026-11-07)

### Alterado

- O nome da família saiu do topo da lista; a tela Família passa a se chamar só "Família".

### Adicionado

- Botão quadrado com lixeira no canto do topo da lista, para limpar a lista toda. Pede confirmação e oferece Desfazer.

## 3.3.1 (2026-11-07)

### Corrigido

- O app continuava mostrando a versão antiga depois de uma atualização, até ser recarregado duas vezes. Agora ele procura versão nova ao abrir, ao voltar para a tela e a cada hora, e recarrega sozinho quando encontra.

## 3.3.0 (2026-11-07)

Um link só para a família.

### Alterado

- Para entrar, basta abrir o endereço do app e digitar o nome; não existe mais link de convite.
- Quem entra primeiro vira administrador.
- A tela Família mostra o endereço com um botão Copiar, e o administrador pode **fechar a entrada** depois que todos entraram. Quem já está continua usando normalmente.
- O botão de gerar novo convite foi removido.

### Observação

- Com a entrada aberta, qualquer pessoa que descobrir o endereço consegue entrar. Feche a entrada quando a família toda estiver dentro.

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
