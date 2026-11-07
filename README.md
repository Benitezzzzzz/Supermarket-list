# Lista do Mercado

Lista de compras compartilhada da família. Abre por um link, instala no celular como app, atualiza em tempo real entre os aparelhos e funciona sem internet dentro do mercado. Ninguém precisa criar senha.

**Stack:** React 19, TypeScript, Vite e PWA no frontend; Hono rodando em Cloudflare Workers, banco Cloudflare D1 (SQLite) e um Durable Object por família para o tempo real; Zod para validar o contrato entre os dois lados.

**No ar:** https://lista-do-mercado.lista-do-mercado.workers.dev. Para entrar, abra o endereço e digite seu nome.

**Hospedagem:** tudo no plano gratuito da Cloudflare, sem servidor próprio para manter. As mudanças estão no [CHANGELOG](CHANGELOG.md), e a decisão está registrada em [docs/plano-publicacao-cloudflare.md](docs/plano-publicacao-cloudflare.md).

## Rodando localmente

Requer Node.js 24 ou mais novo. Tudo roda no simulador local da Cloudflare, sem conta.

```bash
npm install
npm run db:migrate
npm run family:create -- "Minha Família" --importar server/seed/lista-familia.json
npm run preview
```

Abra o endereço que o `family:create` mostrar e digite seu nome. Quem entra primeiro vira administrador.

| Comando | O que faz |
|---|---|
| `npm run preview` | Gera o site e sobe o app completo em `localhost:8787` |
| `npm run dev` | API em `8787` e frontend com recarga automática em `5173` (use `--url http://localhost:5173` no `family:create`) |
| `npm test` | Roda os testes |
| `npm run lint` | Roda o lint |
| `npm run db:migrate` | Aplica as migrações no banco local |
| `npm run family:create -- "Nome"` | Cria uma família e mostra o convite |
| `npm run deploy` | Publica na Cloudflare |

O banco local fica em `.wrangler/`, fora do Git. Apagar essa pasta zera os dados de teste.

## Publicando

Precisa de uma conta gratuita na Cloudflare.

```bash
npx wrangler login
npx wrangler d1 create lista-do-mercado   # copie o database_id para o wrangler.jsonc
npm run deploy
npm run family:create -- "Minha Família" --importar server/seed/lista-familia.json --remoto --url https://lista-do-mercado.SEU-SUBDOMINIO.workers.dev
```

### Publicação automática

O workflow `ci.yml` publica a cada push na `main` depois de os testes passarem, e também pode ser disparado pela aba Actions. Já está configurado neste repositório. Para ligar, configure no GitHub, em **Settings > Secrets and variables > Actions**:

- **Secrets:** `CLOUDFLARE_API_TOKEN`, um token com permissão de editar Workers e D1, e `CLOUDFLARE_ACCOUNT_ID`.
- **Variável:** `DEPLOY_ENABLED` com o valor `true`.

### Limites do plano gratuito

Por dia: 100 mil requisições ao Worker, 5 milhões de leituras e 100 mil escritas no D1, e 100 mil requisições aos Durable Objects. Arquivos do site não contam. Se um limite estourar, as chamadas falham até a meia-noite UTC; não há cobrança. A fila offline guarda as alterações nesse meio-tempo.

## Backup

São duas camadas:

- **Time Travel do D1:** a Cloudflare permite voltar o banco para qualquer minuto dos últimos 7 dias, com `npx wrangler d1 time-travel restore lista-do-mercado --timestamp=<data>`.
- **Cópia diária no GitHub:** o workflow `backup.yml` exporta o banco todo dia, criptografa e guarda por 30 dias nos artefatos da Action. Além dos dois segredos da Cloudflare, ele precisa do segredo `BACKUP_PASSPHRASE` e da variável `BACKUP_ENABLED` com o valor `true`. Guarde essa senha em outro lugar: sem ela, o backup não abre.

Para restaurar uma cópia do GitHub:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in lista-AAAA-MM-DD.sql.enc -out backup.sql
npx wrangler d1 execute lista-do-mercado --remote --file backup.sql
```

O GitHub pausa workflows agendados em repositórios sem atividade por 60 dias. Se isso acontecer, reative o `backup.yml` na aba Actions.

## Arquitetura

```
shared/contract.ts      tipos e validação usados pelos dois lados
server/
  worker.ts             entrada do Worker
  app.ts                monta a API
  db/                   interface do banco e migrações do D1
  services/             regras de famílias, membros, convites e listas
  http/                 rotas, autenticação e tempo real
    familyEvents.ts     Durable Object que guarda os WebSockets de uma família
  scripts/              criar família
  seed/                 lista migrada da versão anterior
src/
  domain/               regras puras: itens, quantidade, categorias, importação
  data/
    syncedList.ts       escrita otimista e fila offline (o coração do app)
    backend.ts          contrato entre a lista e o armazenamento
    apiBackend.ts       implementação que fala com a API
    session.ts          entrada na família e sessão do aparelho
  hooks/  components/
```

A Cloudflare serve o site direto. Só as rotas `/api/*` passam pelo Worker, então site e API ficam na mesma origem, sem CORS.

Nos testes, o banco é um adaptador sobre o SQLite do Node com a mesma interface do D1 e as mesmas migrações.

### API

| Método e rota | Função | Acesso |
|---|---|---|
| `POST /api/session` | Entra na família pelo nome (ou convite, com várias famílias) | Entrada aberta |
| `GET /api/session` | Dados da sessão atual | Membro |
| `GET /api/list` | Itens, categorias e últimas compras | Membro |
| `PUT /api/items` | Cria ou altera itens | Membro |
| `POST /api/items/delete` | Remove itens | Membro |
| `POST /api/categories` | Cria categoria | Membro |
| `POST /api/purchases` | Registra a compra e tira os itens da lista | Membro |
| `PUT /api/purchases/:id` | Corrige valor e forma de pagamento | Membro |
| `DELETE /api/purchases/:id` | Exclui a compra (só marca) | Membro |
| `POST /api/purchases/:id/restore` | Desfaz a exclusão | Membro |
| `GET /api/events` | Avisos em tempo real (WebSocket) | Membro |
| `GET /api/family/members` | Lista os membros | Membro |
| `DELETE /api/family/members/:id` | Remove um membro | Administrador |
| `GET /api/family` | Mostra se a entrada está aberta | Membro |
| `PUT /api/family/entry` | Abre ou fecha a entrada de pessoas novas | Administrador |

### Sincronização

Cada alteração é uma operação pequena e idempotente que mexe só nos itens dela. A tela mostra a última versão confirmada pelo servidor somada à fila do que ainda não foi enviado. Isso traz três garantias:

- A tela responde na hora, mesmo com sinal ruim.
- Sem internet, as alterações ficam salvas no aparelho e são enviadas quando a conexão volta, mesmo que o app tenha sido fechado.
- Duas pessoas mexendo ao mesmo tempo não apagam o trabalho uma da outra. Se as duas alterarem o mesmo item, vale a última.

Cada família tem um Durable Object que guarda os WebSockets abertos. Quando algo muda, ele envia um aviso sem dados, e cada aparelho relê a lista pela API autenticada. Com a API de hibernação, conexões paradas não consomem a cota de tempo de execução. O app também relê ao voltar para a tela e ao recuperar a conexão.

### Segurança

- **Sem cadastro público:** famílias só nascem pelo comando `family:create`.
- **Isolamento:** a família vem sempre da sessão, nunca de um id enviado pelo cliente. A chave dos itens inclui a lista, então o id de um item de outra família não alcança a linha dela.
- **Sessão:** um token aleatório de 256 bits por aparelho, em cookie `HttpOnly`, `SameSite=Strict` e `Secure`. O banco guarda só o hash.
- **Entrada:** com uma família só no app, basta abrir o endereço e digitar o nome. Enquanto a entrada estiver aberta, qualquer pessoa que descobrir o endereço consegue entrar; por isso o administrador pode fechá-la na tela Participantes depois que todos entraram. Ele também vê quem está na lista e remove aparelhos, que são desconectados na hora. Se o mesmo app tiver mais de uma família, a entrada passa a exigir o convite de cada uma.
- **Validação:** todo dado de entrada passa pelo Zod no servidor, e o banco repete os limites com `CHECK`.

Como não há senha, o administrador não recupera o acesso se perder o aparelho: para isso, a tabela `members` precisa ser ajustada com `wrangler d1 execute`.

## Funcionalidades

- Adicionar item com categoria e criar categorias novas
- Quantidade: digite "2 frangos" ou ajuste depois no lápis (medidas como "2 kg arroz" ficam no nome)
- Marcar como comprado tocando na linha
- Trocar a categoria de um item
- Importar vários itens colando texto; uma linha com o nome de uma categoria vira título
- Limpar comprados, ou a lista toda pela lixeira no topo
- Finalizar compra: valor, forma de pagamento (PIX, dinheiro, débito ou crédito, à vista ou parcelado) e limpeza da lista
- Aba Gastos: últimas compras com a lista de itens de cada uma, total do mês, correção de valor ou forma de pagamento e exclusão com Desfazer
- Tela Participantes: ver quem está na lista, copiar o endereço e, para o administrador, remover aparelhos e fechar a entrada
- Desfazer depois de remover ou limpar o carrinho
- Tema claro e escuro automático

## Design System

Proposta "Friendly & Family": pensada para uma família com pessoas de várias idades usando o app com uma mão, no mercado.

- **Tokens:** tudo em `src/styles/tokens.css`, entre cores, tipografia, espaçamento, bordas, sombras e camadas, com tema claro e escuro. Os componentes em `src/styles/app.css` só usam esses tokens.
- **Tipografia:** Fredoka nos títulos, Atkinson Hyperlegible no texto (feita para leitura fácil). Itens com 19px; campos com 20px.
- **Cores:** creme quente, verde-folha para ação, girassol para quantidade e desfazer, tomate só para remover. Cada categoria tem cor e ícone próprios.
- **Toque:** alvos de 48 a 68px; barra inferior com Lista, Gastos e Participantes, e o botão de adicionar flutuando no alcance do polegar.
- **Componentes compartilhados** em `src/ui/`: `BottomSheet`, `ConfirmSheet`, `Toast` e `Icon`.

## Histórico

A primeira versão era um Claude Artifact, que exigia conta Claude para editar e guardava os dados dentro do próprio HTML. Cada salvamento reescrevia a página inteira, e o link compartilhado podia ficar preso numa versão antiga. O código dessa fase está no histórico do Git, e a lista dela foi migrada para `server/seed/lista-familia.json`.
