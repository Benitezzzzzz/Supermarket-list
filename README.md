# Lista do Mercado

Listas de compras compartilhadas. Cada pessoa tem usuário e senha e pode participar de várias listas, como "Casa" e "Pousada", cada uma com seus participantes e seus gastos. Instala no celular como app, atualiza em tempo real entre os aparelhos e funciona sem internet dentro do mercado.

**Stack:** React 19, TypeScript, Vite e PWA no frontend; Hono rodando em Cloudflare Workers, banco Cloudflare D1 (SQLite) e um Durable Object por lista para o tempo real; Zod para validar o contrato entre os dois lados.

**No ar:** https://lista-mercado.benitez.workers.dev. Para começar, crie uma conta.

**Hospedagem:** tudo no plano gratuito da Cloudflare, sem servidor próprio para manter. As mudanças estão no [CHANGELOG](CHANGELOG.md), a decisão de hospedagem em [docs/plano-publicacao-cloudflare.md](docs/plano-publicacao-cloudflare.md) e os próximos passos em [docs/proximas-funcionalidades.md](docs/proximas-funcionalidades.md).

## Rodando localmente

Requer Node.js 24 ou mais novo. Tudo roda no simulador local da Cloudflare, sem conta na Cloudflare.

```bash
npm install
npm run db:migrate
npm run preview
```

Abra `http://localhost:8787`, crie uma conta e a primeira lista.

| Comando | O que faz |
|---|---|
| `npm run preview` | Gera o site e sobe o app completo em `localhost:8787` |
| `npm run dev` | API em `8787` e frontend com recarga automática em `5173` |
| `npm test` | Roda os testes |
| `npm run lint` | Roda o lint |
| `npm run db:migrate` | Aplica as migrações no banco local |
| `npm run user:reset-password -- <usuario> [--remoto]` | Redefine a senha de quem esqueceu e mostra a nova |
| `npm run user:set-superadmin -- <usuario> [--remoto] [--remover]` | Dá ou tira o papel de administrador geral |
| `npm run deploy` | Publica na Cloudflare |

O banco local fica em `.wrangler/`, fora do Git. Apagar essa pasta zera os dados de teste.

## Publicando

Precisa de uma conta gratuita na Cloudflare.

```bash
npx wrangler login
npx wrangler d1 create lista-do-mercado   # copie o database_id para o wrangler.jsonc
npm run deploy
```

### Publicação automática

O workflow `ci.yml` publica a cada push na `main` depois de os testes passarem, e também pode ser disparado pela aba Actions. Já está configurado neste repositório. Para ligar em outro repositório, configure no GitHub, em **Settings > Secrets and variables > Actions**:

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
shared/
  contract.ts           tipos e validação usados pelos dois lados
  password.ts           derivação da senha (PBKDF2), igual no app e no comando de senha
server/
  worker.ts             entrada do Worker
  app.ts                monta a API
  db/                   interface do banco e migrações do D1
  services/
    accounts.ts         contas, senhas, sessões e transferência dos aparelhos antigos
    memberships.ts      quem participa de qual lista (a fonte de permissão)
    lists.ts            itens, categorias e compras de uma lista
  http/                 rotas, autenticação e tempo real
    familyEvents.ts     Durable Object que guarda os WebSockets de uma lista
  scripts/              redefinir senha
src/
  domain/               regras puras: itens, quantidade, categorias, dinheiro, importação
  data/
    syncedList.ts       escrita otimista e fila offline (o coração do app)
    apiBackend.ts       implementação que fala com a API de uma lista
    auth.ts             entrar, criar conta, sair e trocar senha
    listsApi.ts         criar, renomear, excluir listas e gerenciar participantes
  hooks/  components/  ui/
```

A Cloudflare serve o site direto. Só as rotas `/api/*` passam pelo Worker, então site e API ficam na mesma origem, sem CORS.

Nos testes, o banco é um adaptador sobre o SQLite do Node com a mesma interface do D1 e as mesmas migrações.

### API

| Método e rota | Função | Acesso |
|---|---|---|
| `POST /api/auth/signup` | Cria a conta e entra | Público |
| `POST /api/auth/login` | Entra com usuário e senha | Público |
| `POST /api/auth/logout` | Sai neste aparelho | Logado |
| `GET /api/auth/me` | Conta e listas de quem está logado | Logado |
| `POST /api/auth/claim` | Aparelho da versão anterior cria a conta levando a lista | Aparelho antigo |
| `PUT /api/auth/password` | Troca a senha e desconecta os outros aparelhos | Logado |
| `GET /api/admin/overview` | Todas as contas e listas | Administrador geral |
| `PUT /api/admin/users/:id/password` | Define senha nova, destrava e desconecta | Administrador geral |
| `POST /api/admin/users/:id/logout` | Desconecta todos os aparelhos da pessoa | Administrador geral |
| `POST /api/lists` | Cria uma lista | Logado |
| `GET /api/lists/:id` | Itens, categorias e últimas compras | Participante |
| `PATCH /api/lists/:id` | Renomeia | Administrador |
| `DELETE /api/lists/:id` | Exclui com tudo dentro | Administrador |
| `POST /api/lists/:id/leave` | Sai da lista | Participante comum |
| `GET /api/lists/:id/members` | Participantes | Participante |
| `POST /api/lists/:id/members` | Adiciona pelo usuário | Administrador |
| `DELETE /api/lists/:id/members/:userId` | Remove e desconecta | Administrador |
| `PUT /api/lists/:id/items` | Cria ou altera itens | Participante |
| `POST /api/lists/:id/items/delete` | Remove itens | Participante |
| `POST /api/lists/:id/categories` | Cria categoria | Participante |
| `POST /api/lists/:id/purchases` | Registra a compra e tira os itens da lista | Participante |
| `PUT /api/lists/:id/purchases/:pid` | Corrige valor e forma de pagamento | Participante |
| `DELETE /api/lists/:id/purchases/:pid` | Exclui a compra (só marca) | Participante |
| `POST /api/lists/:id/purchases/:pid/restore` | Desfaz a exclusão | Participante |
| `GET /api/lists/:id/events` | Avisos em tempo real (WebSocket) | Participante |

Para quem não participa, qualquer rota de uma lista responde 404, como se ela não existisse. O administrador geral é a exceção: abre qualquer lista com poderes de administrador.

### Sincronização

Cada alteração é uma operação pequena e idempotente que mexe só nos itens dela. A tela mostra a última versão confirmada pelo servidor somada à fila do que ainda não foi enviado. Isso traz três garantias:

- A tela responde na hora, mesmo com sinal ruim.
- Sem internet, as alterações ficam salvas no aparelho e são enviadas quando a conexão volta, mesmo que o app tenha sido fechado.
- Duas pessoas mexendo ao mesmo tempo não apagam o trabalho uma da outra. Se as duas alterarem o mesmo item, vale a última.

Cada lista tem um Durable Object que guarda os WebSockets abertos. Quando algo muda, ele envia um aviso sem dados, e cada aparelho relê a lista pela API autenticada. Com a API de hibernação, conexões paradas não consomem a cota de tempo de execução. O app também relê ao voltar para a tela e ao recuperar a conexão.

### Segurança

- **Senha:** nunca sai do aparelho. Ela vira uma chave com PBKDF2-SHA256 (600 mil iterações) e o servidor guarda só SHA-256 de um sal aleatório com essa chave. Assim o trabalho pesado fica no celular, e o servidor cabe no limite de 10 ms de CPU do plano gratuito.
- **Tentativas:** depois de 5 senhas erradas, a conta fica bloqueada por 15 minutos. A mensagem de erro é a mesma para usuário inexistente e senha errada.
- **Sessão:** um token aleatório de 256 bits por aparelho, em cookie `HttpOnly`, `SameSite=Strict` e `Secure`. O banco guarda só o hash. Trocar a senha desconecta os outros aparelhos.
- **Isolamento:** toda rota de uma lista confere em `list_members` se a pessoa participa. A chave dos itens e das compras inclui a lista, então um id de outra lista não alcança a linha.
- **Administrador geral:** vê todas as contas e listas e gera senha nova para quem esqueceu, pelo painel em Sua conta. Nem ele vê senhas: elas não ficam guardadas. O papel só é dado pelo comando `user:set-superadmin`.
- **Sem e-mail:** quem esquecer a senha pede ao administrador geral, pelo painel ou pelo comando `npm run user:reset-password -- <usuario> --remoto`.
- **Validação:** todo dado de entrada passa pelo Zod no servidor, e o banco repete os limites com `CHECK`.

## Funcionalidades

- Contas com usuário e senha; trocar senha e sair em "Sua conta"
- Várias listas por pessoa, com troca pelo nome da lista no topo
- Participantes por lista: adicionar pelo usuário, remover, renomear e excluir a lista, ou sair dela
- Adicionar item com categoria e criar categorias novas
- Quantidade: digite "2 frangos" ou ajuste depois no lápis (medidas como "2 kg arroz" ficam no nome)
- Marcar como comprado tocando na linha: o item fica riscado no mesmo lugar
- Importar vários itens colando texto ou uma mensagem do WhatsApp (data, nome, emojis e marcadores são ignorados; "arroz, feijão" e "Arroz x2" funcionam), com prévia antes de importar; uma linha com o nome de uma categoria vira título
- No Android, com o app instalado, compartilhar a mensagem do WhatsApp direto para a Lista do Mercado
- Lixeira no topo: limpar só os riscados ou a lista toda
- Finalizar compra: valor, forma de pagamento (PIX, dinheiro, débito ou crédito, à vista ou parcelado) e limpeza da lista
- Aba Gastos, separada por lista: últimas compras com os itens de cada uma, total do mês, correção e exclusão com Desfazer
- Cupom fiscal (NFC-e) em cada compra: foto lida por IA grátis (Workers AI) ou QR code; liga os produtos do cupom aos itens da lista, mostra o que veio fora da lista e o que faltou, e devolve à lista o que faltou
- Desfazer depois de remover ou limpar
- Tema claro e escuro automático

## Design System

Proposta "Friendly & Family": pensada para uma família com pessoas de várias idades usando o app com uma mão, no mercado.

- **Tokens:** tudo em `src/styles/tokens.css`, entre cores, tipografia, espaçamento, bordas, sombras e camadas, com tema claro e escuro. Os componentes em `src/styles/app.css` só usam esses tokens.
- **Tipografia:** Fredoka nos títulos, Atkinson Hyperlegible no texto (feita para leitura fácil). Itens com 19px; campos com 20px.
- **Cores:** creme quente, verde-folha para ação, girassol para quantidade, finalizar e desfazer, tomate só para remover. Cada categoria tem cor e ícone próprios.
- **Toque:** alvos de 48 a 68px; barra inferior com Lista, Gastos e Participantes, e acima dela os botões Finalizar e Adicionar, no alcance do polegar.
- **Componentes compartilhados** em `src/ui/`: `BottomSheet`, `ConfirmSheet`, `Toast` e `Icon`.

## Histórico

A primeira versão era um Claude Artifact, que exigia conta Claude para editar e guardava os dados dentro do próprio HTML. Depois vieram o acesso por link e, na versão 4, as contas com várias listas. Os aparelhos das versões anteriores criam a conta na primeira abertura e levam a lista junto.
