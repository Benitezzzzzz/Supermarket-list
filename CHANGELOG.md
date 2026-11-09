# Changelog

## 4.10.0 (2026-11-09)

### Adicionado

- **Cupom no Finalizar:** "Ler o cupom fiscal" logo no começo do Finalizar. O valor da compra vem preenchido com o total do cupom, e o cupom fica guardado na compra ao finalizar. O que faltou comprar pode voltar para a lista.
- **Salvar a compra como modelo:** na pergunta "Finalizar lista?", a opção "Salvar como modelo de lista" abre o novo modelo já com os itens da compra, para dar um nome.
- **Categoria nos modelos:** cada item do modelo mostra a categoria e deixa trocar.
- **− e + na lista:** a quantidade muda na própria linha, sem abrir o item.
- **Arrastar para marcar:** arrastar a linha para o lado marca ou desmarca o item.
- **Enviar lista:** botão no cabeçalho que manda o que falta comprar pelo WhatsApp (ou outro app), separado por categoria e com a quantidade. Colada de volta no app, a lista entra igual.
- **Por mercado, em Gastos:** quanto foi gasto em cada mercado no mês, com barras, e "Onde sai mais barato", que compara o último preço do mesmo produto em mercados diferentes. Usa os cupons lidos.

## 4.9.0 (2026-11-09)

### Mudado

- **Quantidade no fim do nome:** em Novo item, "peixe 2x", "peixe x2", "peixe (2)" e "peixe 2 un" viram 2× Peixe, como já acontecia com "2 peixe" e "2x peixe". Medidas continuam no nome ("Arroz 5kg", "Coca-Cola 2L").
- **Prévia ao digitar:** abaixo do campo aparece "Vai entrar como 2× Peixe".
- **Sempre com a quantidade:** a lista, os avisos, a colagem do WhatsApp, as compras e o cupom mostram "1× Peixe" também quando é uma unidade só.
- A leitura da quantidade fica num só lugar (`src/domain/quantity.ts`), usada no Novo item e na colagem.

## 4.8.1 (2026-11-09)

### Mudado

- **Botão de tema no cabeçalho:** o ícone de sol/lua abre o painel "Tema e tela", com Automático, Claro e Escuro. Antes, o sol do celular era o modo mercado e parecia um botão de tema quebrado.
- O **modo mercado** virou um interruptor dentro desse painel. Quando ligado, o botão mostra um ponto laranja.
- A escolha de tema saiu de "Sua conta" e ficou só no painel novo.

### Segurança

- Teste garante que a API não libera CORS: app e API usam o mesmo endereço, e outro site não consegue ler os dados.

## 4.8.0 (2026-11-08)

### Adicionado

- **Código de barras do produto:** "Ler código de barras" em Novo item. Funciona pela câmera ao vivo ou pela foto do código.
  - Se a lista conhece o código, o item entra direto com nome e categoria.
  - Os nomes saem do que a lista aprendeu ou dos cupons já lidos, sem base externa paga.
  - Na primeira vez, a pessoa digita o nome; da próxima, ele entra sozinho.
- **Estimativa da lista** no cabeçalho, somando o último preço pago de cada item, e quantos itens ainda não têm preço.
- **Aviso de preço:** na lista, "▲ 15%" ou "▼ 10%" quando o último preço subiu ou caiu 10% ou mais em relação à compra anterior.
- **Modo mercado:** um botão no cabeçalho mantém a tela acesa enquanto a lista está aberta. A escolha fica salva no aparelho.

### Mudado

- Ícones PNG da tela inicial no verde novo.
- GitHub Actions nas versões atuais (checkout, setup-node e upload-artifact v7, em Node 24).
- O CSS foi dividido por assunto em `src/styles/`: base, lista, gastos, painéis, cupom, telas largas e impressão.
- Os painéis de compra (editar, preços e cupom) saíram do `App.tsx` para `PurchaseSheets`.
- O Worker antigo `lista-do-mercado` foi excluído da Cloudflare.

### Banco de dados

- Migração `0010_codigos_de_barras.sql`: tabela `barcodes`, com os códigos aprendidos por lista.

## 4.7.0 (2026-11-08)

### Adicionado

- **Cupom grande em várias fotos:** depois da primeira foto, a revisão oferece "Foto da continuação" e "Da galeria", e a galeria aceita várias fotos de uma vez, até 6 por cupom.
  - Cada foto é lida separadamente, e as partes se juntam na ordem.
  - Linhas repetidas na emenda de fotos sobrepostas entram uma vez só.
  - Loja, CNPJ e data vêm da primeira foto que os tiver; o total, da última.
  - As ligações já acertadas na revisão continuam como estavam.
  - Se uma foto falhar, as outras não se perdem.
- Depois de ler só o QR code, a foto do cupom completa o mesmo cupom, mantendo a chave de acesso.

## 4.6.0 (2026-11-08)

### Mudado

- **Novo visual "Supermercado Moderno"** (escolhido entre 3 propostas): verde de feira, laranja de oferta e uma cor por categoria. Fonte Plus Jakarta Sans e cantos bem arredondados. O tema escuro foi refeito em verde-mata.
- **Lista:**
  - cabeçalho verde com o nome da lista, a saudação, um anel com quanto já está no carrinho e um campo para adicionar item;
  - filtro por categoria;
  - cada item num card, com o ícone da categoria, que vira um visto ao marcar, e um lápis para editar.
- **Barra de navegação** flutuante e escura, com a aba atual em laranja. Finalizar ficou laranja e Adicionar verde.
- **Gastos:** o total do mês fica num card verde com a variação em selo; gráfico e compras em cards brancos arredondados.
- **Cores do app** em Sua conta: Automático (igual ao aparelho), Claro ou Escuro. A escolha vale só no aparelho e é aplicada antes de a página aparecer, para não piscar.
- Os modelos de lista ganharam um ícone de planilha.
- **Endereço novo:** https://lista-mercado.benitez.workers.dev (o Worker passou a se chamar `lista-mercado`). O endereço antigo deixou de existir com a troca do subdomínio da conta; é preciso entrar de novo e reinstalar o app.
- Painéis, campos, botões, participantes e modelos seguem o mesmo visual. Cor do tema, ícone e manifesto do app foram atualizados.
## 4.5.0 (2026-11-08)

### Adicionado

- **Histórico por mês em Gastos:** resumo do mês com total, quantidade e média por compra, e a diferença para o mês anterior (com seta e texto, não só cor). O gráfico dos últimos 6 meses pode ser tocado: escolher um mês mostra só as compras dele. Os valores também aparecem em tabela.
- As compras ficam agrupadas por mês, da mais nova para a mais antiga.
- O card aberto compara a compra com a anterior e com a média das 5 anteriores ("R$ 20,00 a mais (+20%)").
- O snapshot traz as 50 compras mais recentes. Os totais por mês contam o histórico todo, pela rota nova `GET /lists/:id/months`, no horário de Brasília.
- **Preços e marcas por item:** em Gastos, o card aberto tem "Preços". Nada é obrigatório. O preço é de cada unidade, a marca tem sugestões das já usadas e o último preço aparece como referência, nunca preenchido sozinho. A soma dos preços pode virar o valor da compra.
- Quando a compra tem cupom, o preço do cupom vale até a pessoa digitar outro.
- **Histórico de preços:** cada produto guarda preço, marca, quantidade e data. "Leite" e "leites" contam como o mesmo produto.
  - Ao digitar um item, aparece a última compra (preço, marca e data).
  - Na lista, cada item mostra o último preço como referência.
  - Em Editar item ficam a variação do preço, a comparação entre marcas (média, menor e última) e as compras anteriores.
- O preço de cada item guarda a origem (`manual`, `cupom` ou `codigo`) e o código de barras, já preparado para a leitura futura pelo código ou pela nota.
- **Modelos de lista:** um botão no topo da lista abre os modelos. Dá para salvar a lista atual como modelo, criar um modelo vazio, editar nome e itens, e definir um modelo como padrão (só um por lista).
  - Com a lista vazia, aparece "Usar 'nome do modelo padrão'".
  - Usar um modelo põe os itens na lista sem preço e sem duplicar o que já está nela, com Desfazer.

- **Mudar o nome da lista:** em "Suas listas" (toque no nome da lista no topo), cada lista que você administra tem um lápis para editar o nome, com aviso de que salvou. Em Participantes, o campo ganhou rótulo visível e também confirma a mudança. Quem só participa não vê a opção.

### Banco de dados

- Migração `0009_precos_e_modelos.sql`: tabela `templates`. Preço e marca ficam no JSON de `purchases.items`, sem coluna nova.

## 4.4.0 (2026-11-08)

### Adicionado

- **PDF de uma compra:** em Gastos, a compra aberta tem o botão "PDF". Ele abre a impressão do aparelho, onde dá para escolher "Salvar como PDF". O relatório traz valor, pagamento, data, quem registrou, loja, CNPJ e os itens (com preço quando há cupom). Sem biblioteca e sem servidor.

### Mudado

- **Cards de Gastos:** tocar na compra abre o card com animação e mostra a lista inteira de itens. Tocar de novo fecha. Abre uma compra por vez.
- As ações ficam dentro do card aberto: Ler cupom ou Cupom, PDF, Editar e Excluir.
- Saíram o botão "Corrigir" e o "Ver os itens". O painel "Corrigir compra" agora se chama "Editar compra".
## 4.3.0 (2026-11-07)

### Adicionado

- **Cupom fiscal (NFC-e) na compra:** em Gastos, cada compra tem "Ler cupom". Dá para tirar foto do cupom, escolher da galeria ou ler só o QR code.
- A foto é lida pela IA do Workers AI (modelo Llama 4 Scout, plano grátis da Cloudflare): loja, CNPJ, data, produtos, quantidades, preços e total. A foto não é guardada.
- O QR code é lido no aparelho (ZXing em WebAssembly, servido pelo próprio app), na foto ou com a câmera ao vivo. A chave de acesso impede lançar o mesmo cupom em duas compras.
- **Comparação com a lista:** cada produto do cupom é ligado ao item da lista. O app entende abreviações ("LTE", "PAP HIG"), plural, acento e erros de leitura da foto. Mostra "Da lista", "Fora da lista" e "Faltou comprar".
- Na revisão dá para trocar a ligação de cada produto, escolher quais itens que faltaram voltam para a lista e usar o total do cupom como valor da compra.
- Em Gastos, compra com cupom mostra o preço pago em cada item da lista e o nome da loja.
- Link para conferir a nota no site da Sefaz-PB. O QR antigo dos cupons aponta para um endereço que não responde mais; o app usa o atual.
- Limite de 30 leituras de foto por lista por dia, para não esgotar a cota grátis da IA.

### Banco de dados

- Migração `0008_cupons.sql`: tabelas `receipts`, `receipt_items` (com o código de barras de cada produto, base para o histórico de preços) e `receipt_reads`.

## 4.2.0 (2026-11-07)

### Adicionado

- **Lista do WhatsApp:** "Colar vários itens" entende mensagens copiadas do WhatsApp. Ignora data, hora e nome de quem mandou, emojis, marcadores, negrito, "<Mídia oculta>" e mensagens apagadas.
- Vários itens na mesma linha separados por vírgula ("arroz, feijão, café"), sem quebrar "1,5 kg".
- Quantidade no fim também vale: "Arroz x2", "Leite (3)", "Ovos - 2 un".
- Títulos comuns viram categoria: "Frutas", "Verduras", "Feira" → Hortifruti; "Carnes" → Açougue e Peixaria; "Frios" → Laticínios e Frios; "Higiene" → Higiene e Farmácia; "Produtos de limpeza" → Limpeza.
- Títulos como "*Compras do mês*" ou "Lista do mercado:" não viram item; itens repetidos entram uma vez.
- Prévia do que vai entrar, separada por categoria, com o nome da lista que vai receber.
- Botão "Colar o que copiei" lê a área de transferência.
- **Android:** com o app instalado, o WhatsApp mostra "Lista do Mercado" em Compartilhar. O texto abre direto em "Colar vários itens", mesmo se antes for preciso entrar na conta.

## 4.1.0 (2026-11-07)

### Adicionado

- **Administrador geral:** vê todas as contas e listas (inclusive as que não participa), abre e edita qualquer lista, gera senha nova para quem esqueceu e desconecta aparelhos. Fica em Sua conta → Administração geral.
- O papel só é dado pelo comando `npm run user:set-superadmin -- <usuario> --remoto`; a API não tem como promover ninguém.
- As senhas continuam sem ficar guardadas: o painel gera uma senha nova no aparelho do administrador e manda só a chave derivada ao servidor.

### Banco de dados

- Migração `0007_admin_geral.sql`: coluna `is_superadmin` em `users`.

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
