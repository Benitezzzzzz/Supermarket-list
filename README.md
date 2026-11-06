# Lista do Mercado

Lista de compras compartilhada da família. Abre por um link, instala no celular como app, atualiza em tempo real entre os aparelhos e funciona sem internet dentro do mercado. Ninguém precisa criar senha.

**Stack:** React 19, TypeScript, Vite e PWA no frontend; Node.js, Hono e SQLite no backend; Zod para validar o contrato entre os dois.

**Situação atual:** roda localmente e ainda não foi publicado. A publicação gratuita está planejada em [docs/plano-publicacao-cloudflare.md](docs/plano-publicacao-cloudflare.md), e as mudanças feitas estão no [CHANGELOG](CHANGELOG.md).

## Rodando localmente

Requer Node.js 24 ou mais novo.

```bash
npm install
cp .env.example .env     # ajuste APP_URL para http://localhost:5173
npm run family:create -- "Minha Família" --importar server/seed/lista-familia.json
npm run dev
```

O comando `family:create` mostra o link de convite. Abra esse link no navegador e digite seu nome. Quem entra primeiro vira administrador.

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe API (porta 3000) e frontend com recarga automática (porta 5173) |
| `npm run build` | Checa os tipos e gera o frontend em `dist/` |
| `npm start` | Sobe o app completo na porta 3000 (depois do build) |
| `npm test` | Roda os testes |
| `npm run lint` | Roda o lint |
| `npm run family:create -- "Nome"` | Cria uma família e mostra o convite |
| `npm run backup` | Salva uma cópia do banco em `data/backups/` |

## Colocando no ar

O app precisa de um servidor **sempre ligado, com disco persistente e HTTPS**. O HTTPS é obrigatório para instalar no celular e funcionar offline. Servir só o frontend não basta, e hospedagens com disco temporário apagam o banco a cada reinício.

Com Docker:

```bash
docker build -t lista-mercado .
docker run -d --restart unless-stopped -p 3000:3000 -v lista-dados:/data lista-mercado
docker exec -e APP_URL=https://seu-dominio <container> node server/scripts/create-family.ts "Minha Família" --importar server/seed/lista-familia.json
```

Sem Docker, rode `npm ci`, `npm run build` e `npm start` atrás de um proxy HTTPS, como Caddy ou Cloudflare Tunnel. O proxy precisa enviar o cabeçalho `X-Forwarded-Proto` e não pode segurar respostas em buffer, para não atrasar os avisos em tempo real.

### Backup

Todos os dados ficam em `DATA_DIR/lista.db`. Agende `npm run backup` e copie `DATA_DIR/backups/` para outro lugar. Para restaurar, pare o servidor, troque `lista.db` pelo backup e apague os arquivos `lista.db-wal` e `lista.db-shm`.

## Arquitetura

```
shared/contract.ts   tipos e validação usados pelos dois lados
server/
  app.ts             monta a API
  db/                conexão SQLite e migrações
  services/          regras de famílias, membros, convites e listas
  http/              rotas, autenticação e eventos em tempo real
  scripts/           criar família e fazer backup
  seed/              lista migrada da versão anterior
src/
  domain/            regras puras: itens, quantidade, categorias, importação
  data/
    syncedList.ts    escrita otimista e fila offline (o coração do app)
    backend.ts       contrato entre a lista e o armazenamento
    apiBackend.ts    implementação que fala com a API
    session.ts       entrada na família e sessão do aparelho
  hooks/  components/
```

Um único processo Node serve a API e o site. Por ser a mesma origem, não há CORS, e o cookie de sessão funciona sem exceções.

### API

| Método e rota | Função | Acesso |
|---|---|---|
| `POST /api/session` | Entra na família com o convite | Convite válido |
| `GET /api/session` | Dados da sessão atual | Membro |
| `GET /api/list` | Itens e categorias | Membro |
| `PUT /api/items` | Cria ou altera itens | Membro |
| `POST /api/items/delete` | Remove itens | Membro |
| `POST /api/categories` | Cria categoria | Membro |
| `GET /api/events` | Avisos em tempo real (SSE) | Membro |
| `GET /api/family/members` | Lista os membros | Membro |
| `DELETE /api/family/members/:id` | Remove um membro | Administrador |
| `POST /api/family/invite` | Gera convite novo e invalida o anterior | Administrador |

### Sincronização

Cada alteração é uma operação pequena e idempotente que mexe só nos itens dela. A tela mostra a última versão confirmada pelo servidor somada à fila do que ainda não foi enviado. Isso traz três garantias:

- A tela responde na hora, mesmo com sinal ruim.
- Sem internet, as alterações ficam salvas no aparelho e são enviadas quando a conexão volta, mesmo que o app tenha sido fechado.
- Duas pessoas mexendo ao mesmo tempo não apagam o trabalho uma da outra. Se as duas alterarem o mesmo item, vale a última.

Quando algo muda, o servidor envia um aviso sem dados pelo canal SSE, e cada aparelho relê a lista pela API autenticada. O app também relê ao voltar para a tela e ao recuperar a conexão.

### Segurança

- **Sem cadastro público:** famílias só nascem pelo comando no servidor.
- **Isolamento:** a família vem sempre da sessão, nunca de um id enviado pelo cliente. A chave dos itens inclui a lista, então o id de um item de outra família não alcança a linha dela.
- **Sessão:** um token aleatório de 256 bits por aparelho, em cookie `HttpOnly` e `SameSite=Strict`, marcado como `Secure` em HTTPS. O banco guarda só o hash.
- **Convite:** também aleatório e guardado como hash. Quem tem o link consegue entrar, então compartilhe só com a família. O administrador vê quem entrou, remove aparelhos e troca o link no painel Família.
- **Validação:** todo dado de entrada passa pelo Zod no servidor, e o banco repete os limites com `CHECK`.

Como não há senha, o administrador não recupera o acesso se perder o aparelho: para isso, a tabela `members` precisa ser ajustada no servidor.

## Funcionalidades

- Adicionar item com categoria e criar categorias novas
- Quantidade: digite "2 frangos" ou ajuste depois no lápis (medidas como "2 kg arroz" ficam no nome)
- Marcar como comprado tocando na linha
- Trocar a categoria de um item
- Importar vários itens colando texto; uma linha com o nome de uma categoria vira título
- Limpar comprados
- Painel Família: ver membros e, para o administrador, remover aparelhos e trocar o convite
- Tema claro e escuro automático

## Design

- Títulos em Big Shoulders Stencil, que lembra carimbo de caixote de feira.
- Texto em Atkinson Hyperlegible, feita para leitura fácil.
- Neutros quentes, verde como cor principal e terracota só para ações destrutivas.

## Histórico

A primeira versão era um Claude Artifact, que exigia conta Claude para editar e guardava os dados dentro do próprio HTML. Cada salvamento reescrevia a página inteira, e o link compartilhado podia ficar preso numa versão antiga. O código dessa fase está no histórico do Git, e a lista dela foi migrada para `server/seed/lista-familia.json`.
