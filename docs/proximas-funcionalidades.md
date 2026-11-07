# Próximas funcionalidades

**Status:** etapa 2 (várias listas) e etapa 3 (contas) entregues em 2026-11-07, na versão 4.0.0. A lista vinda do WhatsApp saiu na 4.2.0 e a leitura do cupom fiscal (NFC-e) na 4.3.0. Faltam PDF e código de barras.

Pedido: contas individuais com login, várias listas por pessoa (o pai administra uma pousada e quer listas separadas), exportar os relatórios de compras para PDF e, mais adiante, trazer compras para o app lendo a NFC-e, o código de barras ou o QR code.

Tudo continua cabendo no plano gratuito da Cloudflare.

## Ordem sugerida

Cada etapa funciona sozinha e já entrega valor.

| # | Etapa | Tamanho | Depende de |
|---|---|---|---|
| 1 | Exportar compras para PDF | Pequeno | — |
| 2 | Várias listas e troca de lista | Médio | — |
| 3 | Contas com login | Grande | 2 |
| 4 | Cupom fiscal (NFC-e) por foto e QR code (entregue na 4.3.0) | Médio | 2 |
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

## 4. Cupom fiscal (NFC-e): entregue na 4.3.0

- **O que se descobriu na Sefaz-PB:**
  - O QR dos cupons aponta para `www5.receita.pb.gov.br`, que não responde mais. A consulta atual fica em `www4.sefaz.pb.gov.br`, com o mesmo parâmetro `p`.
  - O botão Consultar tem reCAPTCHA do Google. Por isso o servidor não busca os itens na Sefaz, e o captcha não é contornado.
- **Como ficou:**
  - Em Gastos, cada compra tem "Ler cupom". A foto do cupom é lida pela IA do Workers AI (Llama 4 Scout, plano grátis), que devolve loja, data, produtos e preços. A foto não é guardada.
  - O QR code é lido no aparelho com o ZXing (WebAssembly), na própria foto ou com a câmera ao vivo. Traz a chave de acesso, o CNPJ e, em nota de contingência, o dia e o valor.
  - O app liga cada produto ao item da lista (abreviações, plural, erros de leitura) e mostra "Da lista", "Fora da lista" e "Faltou comprar". A pessoa revisa, escolhe o que volta para a lista e pode usar o total do cupom.
  - Ficam guardados os códigos de barras dos produtos (`receipt_items.code`): base para o histórico de preços e para a etapa 5.
- **Custo:** cerca de 70 "neurons" por cupom pequeno, de 10 mil grátis por dia na conta. O limite é de 30 leituras por lista por dia.

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

**Lista vinda do WhatsApp (entregue na 4.2.0):**

- Melhorar o "Colar vários itens" para entender o formato das mensagens do WhatsApp, como data e hora, nome de quem mandou, negrito, emojis e marcadores.
- No Android, receber o texto pelo botão Compartilhar do WhatsApp, direto no app instalado (Web Share Target). O iPhone não permite isso para apps instalados pelo navegador, então lá continua o copiar e colar.
