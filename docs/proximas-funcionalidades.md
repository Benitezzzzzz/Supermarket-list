# Próximas funcionalidades

**Status:** etapa 2 (várias listas) e etapa 3 (contas) entregues em 2026-11-07, na versão 4.0.0. Faltam PDF, NFC-e, código de barras e a lista vinda do WhatsApp.

Pedido: contas individuais com login, várias listas por pessoa (o pai administra uma pousada e quer listas separadas), exportar os relatórios de compras para PDF e, mais adiante, trazer compras para o app lendo a NFC-e, o código de barras ou o QR code.

Tudo continua cabendo no plano gratuito da Cloudflare.

## Ordem sugerida

Cada etapa funciona sozinha e já entrega valor.

| # | Etapa | Tamanho | Depende de |
|---|---|---|---|
| 1 | Exportar compras para PDF | Pequeno | — |
| 2 | Várias listas e troca de lista | Médio | — |
| 3 | Contas com login | Grande | 2 |
| 4 | Importar NFC-e pelo QR code | Médio | 2 |
| 5 | Ler código de barras de produto | Médio | — |

## 1. Exportar para PDF

- Em Gastos, um botão **Exportar** gera um relatório com período, total, forma de pagamento e a lista de itens de cada compra.
- **Caminho recomendado:** uma página de impressão do próprio app e o "Salvar como PDF" que já existe no celular e no computador. Não precisa de biblioteca, nem de servidor, e funciona sem internet.
- **Extra barato:** exportar também em CSV, para abrir em planilha.
- **Limitação:** o app só guarda os itens das compras feitas a partir da versão 3.7.0.

## 2. Várias listas

- Hoje cada família tem uma lista (`FAMILY_LIST` pega a primeira). As tabelas de itens, categorias e compras já são por lista.
- **Muda:** a pessoa passa a participar de **listas**, e não de uma família. Cada lista tem nome ("Casa", "Pousada"), participantes e gastos próprios.
- **Na tela:** um seletor de lista no topo ("Lista: Pousada ▾") e uma opção para criar lista e chamar participantes.
- **Migração:** a família atual vira a lista "Casa", com os mesmos participantes. Nada se perde.
- **Tempo real e fila offline:** passam a ser separados por lista.

## 3. Contas com login

Hoje o acesso é por aparelho: quem limpa os dados do navegador ou troca de celular precisa entrar de novo e vira outro participante. Uma conta resolve isso e deixa a mesma pessoa usar várias listas em vários aparelhos.

| Opção | Como a pessoa entra | Prós | Contras |
|---|---|---|---|
| **Chave de acesso (passkey)** | Digital ou rosto do celular | Sem senha para esquecer; muito seguro; grátis | Trocar de celular sem a conta Google/Apple sincronizada pede um novo convite |
| E-mail e senha | Digita e-mail e senha | Familiar | Senha esquecida exige envio de e-mail (serviço externo); o hash de senha consome CPU, e o plano grátis limita a 10 ms por chamada |
| Link por e-mail | Toca no link que chega no e-mail | Sem senha | Depende de um serviço de envio de e-mail, que é externo |

**Recomendação:** chave de acesso, com a entrada atual como alternativa.

## 4. Importar NFC-e pelo QR code

- O QR code da nota fiscal do consumidor leva a uma página pública da Secretaria da Fazenda do estado, com os itens, as quantidades e os valores.
- **Como funcionaria:** a câmera lê o QR code, o servidor do app abre essa página e extrai os itens, e o app mostra a compra pronta para conferir e salvar em Gastos, já com o valor de cada item.
- **Atenção:**
  - Cada estado tem seu próprio formato de página, então dá para começar pelo estado de vocês.
  - Alguns estados pedem captcha, e esses não funcionam.
  - Se a Fazenda mudar a página, a leitura precisa de ajuste.
- **Câmera no iPhone:** o leitor nativo do navegador não existe no Safari, então seria preciso uma biblioteca de leitura de códigos, carregada só nessa tela.

## 5. Código de barras do produto

- Ler o código de barras (EAN) de um produto para adicionar à lista sem digitar.
- **O ponto fraco é descobrir o nome do produto pelo código:**
  - **Open Food Facts:** grátis, mas cobre pouco os produtos brasileiros.
  - **Bases comerciais:** cobrem bem o Brasil, mas são pagas ou têm cota diária pequena.
- **Alternativa grátis:** o app aprende. Na primeira vez, a pessoa digita o nome; nas próximas, o código já traz o produto.

## Decisões tomadas (2026-11-07)

1. **Login:** usuário e senha simples.
2. **Estado:** João Pessoa, Paraíba. A leitura de NFC-e começa pela Sefaz-PB.
3. **Pousada:** provavelmente só o pai. Ele quer colar no app a lista que recebe pelo WhatsApp.
4. **Gastos:** separados por lista.

## Próxima etapa

**Lista vinda do WhatsApp:**

- Melhorar o "Colar vários itens" para entender o formato das mensagens do WhatsApp, como data e hora, nome de quem mandou, negrito, emojis e marcadores.
- No Android, receber o texto pelo botão Compartilhar do WhatsApp, direto no app instalado (Web Share Target). O iPhone não permite isso para apps instalados pelo navegador, então lá continua o copiar e colar.
