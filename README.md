# Lista do Mercado

Lista de compras compartilhada da família (uso pessoal, feita sob pedido do Renan pros pais dele). Objetivo: abrir um link, adicionar/marcar itens, e todo mundo ver a mesma lista, sem app pra instalar. **Precisa estar logado numa conta Claude (gratuita) pra conseguir editar** — isso foi validado na prática e não tem como contornar dentro da plataforma de Artifacts (ver decisão abaixo).

- **Link ao vivo (o que a família usa):** https://claude.ai/code/artifact/51a3e53d-c5e2-447e-9efd-db9f94198903
- **Este repositório:** https://github.com/Benitezzzzzz/Supermarket-list (backup do código-fonte)

## Como está publicado

O app roda como um **Claude Artifact** (não é um site hospedado em servidor próprio). Foi publicado com a capability `artifact` do runtime de Artifacts da Claude, que permite a própria página salvar alterações nela mesma (`claude.use("artifact")` → `.publish(html)`).

**Decisão importante:** cheguei a considerar Supabase + GitHub Pages pra ter zero dependência de login e mais controle, mas voltamos atrás porque era trabalho demais pra uma lista de mercado simples. O Artifact do Claude funciona apenas com usuário logado em sua conta do claude. 

## Estrutura de arquivos

```
index.html      — estrutura da página + OS DADOS da lista (ver abaixo, isso é proposital)
css/styles.css  — todo o visual
js/app.js       — toda a lógica (renderizar, adicionar, marcar, categorias, importar)
```

### Por que os dados ficam dentro do index.html e não em um arquivo separado?

Isso é a parte mais importante de entender antes de mexer:

- A runtime do Artifact tem duas formas de salvar: `publish(html)` (substitui o documento inteiro, sempre disponível) e `publish(files)` (atualiza só arquivos específicos, tipo um "save" de editor).
- A forma `publish(files)` **é bloqueada quando o artifact é compartilhado publicamente** (retorna erro `capability_disabled`). Como o nosso link é público (é assim que a família acessa sem login), só sobra a `publish(html)`.
- `publish(html)` reescreve o `index.html` inteiro — por isso os itens da lista (`INITIAL_ITEMS`) e as categorias custom (`CUSTOM_CATEGORIES`) ficam num bloco `<script>` dentro do próprio `index.html`, entre marcadores de comentário:

```html
<script>
/*ITEMS_START*/
const INITIAL_ITEMS = [...];
/*ITEMS_END*/

/*CATS_START*/
const CUSTOM_CATEGORIES = [...];
/*CATS_END*/
</script>
<script src="js/app.js"></script>
```

- Em `js/app.js`, a função `persist()` faz: `fetch(location.href)` (busca o próprio HTML servido agora), troca só o conteúdo entre os marcadores via regex, e publica esse HTML inteiro de novo com `artifactApi.publish(newSource)`.
- `css/styles.css` e `js/app.js` são **estáticos** — nunca são reescritos em tempo de execução, só mudam quando eu (Claude) edito o projeto e publico de novo manualmente.

Se algum dia for tirar o compartilhamento público (só a família logada, por exemplo), aí sim dá pra migrar os dados pra um arquivo próprio via `publish(files)`.

## Cuidado ao editar e republicar

Como qualquer pessoa com o link pode adicionar itens, **o artifact ao vivo pode ter dados mais recentes do que os arquivos locais desse repositório**. Antes de publicar uma mudança:

1. Ler a versão ao vivo do artifact (`Artifact` tool, `action: "read"`, com a URL acima).
2. Copiar o array `INITIAL_ITEMS` (e `CUSTOM_CATEGORIES`) atual pro `index.html` local, se tiver mudado.
3. Só então fazer as alterações desejadas e publicar de novo (`Artifact` tool, `action: "publish"`, passando `url` da mesma artifact pra atualizar em vez de criar uma nova).

Publicar com `files` (pra `css/styles.css` e `js/app.js`) funciona normal mesmo com o artifact público — o bloqueio de `capability_disabled` é só pra chamadas feitas **de dentro da página em tempo de execução**, não pra quando eu publico via ferramenta do Claude Code.

## Funcionalidades

- **Adicionar item**: campo de texto + categoria (dropdown) + botão "Adicionar". Botão "+" do lado do dropdown cria uma categoria nova na hora.
- **Categorias padrão**: Hortifruti, Padaria, Açougue e Peixaria, Laticínios e Frios, Mercearia, Bebidas, Limpeza, Higiene e Farmácia, Congelados, Outros — mais qualquer categoria custom que alguém criar.
- **Marcar como comprado**: toca no item, ele desce pra seção "Já comprado" com risco.
- **Trocar categoria de um item já criado**: ícone 🏷 ao lado do item.
- **Importar lista**: botão "Importar lista" abre uma caixa pra colar vários itens de uma vez (um por linha). Uma linha que seja só o nome de uma categoria conhecida vira um "título" que categoriza as linhas seguintes.
- **Modo local (fallback)**: se por algum motivo a capability do Artifact não estiver disponível na visualização, o app cai pra salvar só em `localStorage` daquele navegador/aparelho (mostra um aviso amarelo avisando disso).

## Problema conhecido: link mostrando versão desatualizada

Já aconteceu do pai do Renan abrir o link e ver uma versão antiga mesmo depois de eu publicar uma atualização. O motivo aparente: o compartilhamento do artifact pode ficar **fixado ("pinned") numa versão específica** em vez de sempre mostrar a mais recente. Isso é uma configuração da própria interface do claude.ai (menu de "Compartilhar" do artifact), não algo que dá pra resolver por aqui via ferramenta. Se acontecer de novo: reabrir o menu de compartilhamento do artifact e conferir/reativar a opção de sempre mostrar a versão mais recente, e reenviar o link.

## Design

- Fonte de título: "Big Shoulders Stencil" (efeito de carimbo de caixote de feira). Fonte de texto: "Atkinson Hyperlegible" (feita pra ser bem legível — importante pros pais do Renan usarem sem esforço).
- Paleta: neutros quentes (bege/papel) + verde (hortifruti/mercado) como cor principal + terracota só pra ações destrutivas (excluir).
- Tema claro/escuro automático (segue o sistema do aparelho).
