import { DEFAULT_CATEGORY } from "./categories";
import { parseQuantity } from "./quantity";

/**
 * Adivinha a categoria de um produto pelo nome, para a lista colada do WhatsApp
 * já entrar separada. Primeiro vale o que a própria lista aprendeu (o mesmo produto
 * já usado numa categoria); depois, um dicionário de produtos comuns.
 */

const HORTIFRUTI = "Hortifruti";
const PADARIA = "Padaria";
const ACOUGUE = "Açougue e Peixaria";
const LATICINIOS = "Laticínios e Frios";
const MERCEARIA = "Mercearia";
const BEBIDAS = "Bebidas";
const LIMPEZA = "Limpeza";
const HIGIENE = "Higiene e Farmácia";
const CONGELADOS = "Congelados";

/** Expressões de mais de uma palavra; valem em qualquer lugar do nome e antes das palavras soltas. */
const PHRASES: [string, string][] = [
  ["papel higienico", HIGIENE],
  ["papel toalha", LIMPEZA],
  ["papel aluminio", LIMPEZA],
  ["papel filme", LIMPEZA],
  ["pasta de dente", HIGIENE],
  ["creme dental", HIGIENE],
  ["fio dental", HIGIENE],
  ["escova de dente", HIGIENE],
  ["absorvente", HIGIENE],
  ["fralda", HIGIENE],
  ["sabao em po", LIMPEZA],
  ["sabao liquido", LIMPEZA],
  ["sabao em barra", LIMPEZA],
  ["agua sanitaria", LIMPEZA],
  ["lava roupa", LIMPEZA],
  ["lava louca", LIMPEZA],
  ["saco de lixo", LIMPEZA],
  ["leite condensado", MERCEARIA],
  ["leite de coco", MERCEARIA],
  ["leite em po", MERCEARIA],
  ["creme de leite", LATICINIOS],
  ["queijo ralado", LATICINIOS],
  ["pao de queijo", CONGELADOS],
  ["pao de forma", PADARIA],
  ["pao frances", PADARIA],
  ["pao de alho", ACOUGUE],
  ["batata palha", MERCEARIA],
  ["batata frita", CONGELADOS],
  ["polpa de fruta", CONGELADOS],
  ["polpa", CONGELADOS],
  ["agua de coco", BEBIDAS],
  ["agua mineral", BEBIDAS],
  ["agua com gas", BEBIDAS],
  ["oleo de soja", MERCEARIA],
  ["azeite de oliva", MERCEARIA],
  ["molho de tomate", MERCEARIA],
  ["extrato de tomate", MERCEARIA],
  ["massa de tomate", MERCEARIA],
  ["carne moida", ACOUGUE],
  ["peito de frango", ACOUGUE],
  ["file de peixe", ACOUGUE],
  ["cheiro verde", HORTIFRUTI],
  ["batata doce", HORTIFRUTI],
  ["feijao verde", HORTIFRUTI],
  ["milho verde", MERCEARIA],
  ["ervilha em lata", MERCEARIA],
  ["sorvete", CONGELADOS],
  ["pizza congelada", CONGELADOS],
  ["lasanha congelada", CONGELADOS],
];

/** Palavras soltas, no singular e sem acento. */
const WORDS: Record<string, string> = {};
function add(category: string, words: string) {
  for (const word of words.split(/\s+/).filter(Boolean)) WORDS[word] = category;
}

add(
  HORTIFRUTI,
  `banana maca laranja limao mamao melao melancia abacaxi manga uva pera goiaba maracuja acerola caju abacate
   morango kiwi tangerina mexerica bergamota ameixa pessego coco graviola caqui pitaya figo
   tomate cebola alho batata cenoura beterraba chuchu abobora abobrinha berinjela pimentao pepino quiabo maxixe
   jerimum macaxeira mandioca aipim inhame cara repolho couve alface rucula agriao espinafre brocolis couveflor
   coentro cebolinha salsa salsinha hortela manjericao gengibre pimenta vagem milho ovo ovos hortalica verdura legume fruta`,
);
add(PADARIA, `pao paes bisnaguinha baguete broa bolo rosca torrada sonho croissant cuscuz tapioca`);
add(
  ACOUGUE,
  `carne frango peixe file bife picanha alcatra patinho acem maminha costela musculo cupim fraldinha coxa sobrecoxa
   asa linguica salsicha bacon calabresa charque jaba camarao sardinha tilapia salmao merluza pescada atum
   bacalhau porco lombo pernil bisteca figado moela hamburguer almondega`,
);
add(
  LATICINIOS,
  `leite iogurte queijo requeijao manteiga margarina presunto mortadela peito apresuntado salame nata coalhada
   mussarela mucarela prato ricota cottage danone danoninho yakult`,
);
add(
  MERCEARIA,
  `arroz feijao macarrao espaguete lasanha farinha fuba flocao acucar sal cafe oleo azeite vinagre molho maionese
   ketchup mostarda biscoito bolacha cereal aveia granola achocolatado nescau toddy gelatina pudim fermento
   tempero colorau cominho oregano louro caldo sazon amido maizena trigo goma sardinha atum milho ervilha
   azeitona palmito extrato catchup doce geleia mel chocolate bombom pipoca amendoim castanha cha lentilha
   grao granola pacoca rapadura miojo lamen massa`,
);
add(
  BEBIDAS,
  `agua refrigerante coca guarana fanta sprite suco cerveja vinho cachaca vodka whisky energetico isotonico
   skol brahma heineken antarctica budweiser itaipava schin refri`,
);
add(
  LIMPEZA,
  `detergente sabao amaciante desinfetante alvejante cloro esponja bombril palha vassoura rodo pano flanela
   multiuso lustra lustramoveis limpador veja qboa omo ype saco lixo inseticida baygon raid naftalina
   guardanapo`,
);
add(
  HIGIENE,
  `sabonete shampoo xampu condicionador desodorante pasta escova creme hidratante protetor absorvente fralda
   cotonete algodao barbeador aparelho lamina gilete esmalte acetona remedio dipirona paracetamol curativo
   alcool colgate sorriso oral rexona nivea lenco`,
);
add(CONGELADOS, `sorvete picole nugget empanado lasanha pizza hamburguer acai`);

/** Ajustes: palavra que o dicionário acima repete em duas categorias fica com a mais comum. */
Object.assign(WORDS, { lasanha: CONGELADOS, hamburguer: ACOUGUE, sardinha: MERCEARIA, atum: MERCEARIA, milho: HORTIFRUTI });

function normalizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Formas no singular de uma palavra: "bananas" → "banana", "limões" → "limao", "pães" → "pao". */
function singulars(word: string): string[] {
  const forms = [word];
  if (word.endsWith("oes") || word.endsWith("aes")) forms.push(`${word.slice(0, -3)}ao`);
  if (word.endsWith("ns")) forms.push(`${word.slice(0, -2)}m`);
  if (word.endsWith("es")) forms.push(word.slice(0, -2));
  if (word.endsWith("s")) forms.push(word.slice(0, -1));
  return forms;
}

function lookupWord(word: string): string | null {
  for (const form of singulars(word)) {
    const category = WORDS[form];
    if (category) return category;
  }
  return null;
}

/** Só pelo dicionário: a primeira palavra manda ("Molho de tomate" é Mercearia, não Hortifruti). */
export function dictionaryCategory(name: string): string | null {
  const normalized = normalizeName(parseQuantity(name).text);
  if (!normalized) return null;
  const padded = ` ${normalized} `;
  for (const [phrase, category] of PHRASES) {
    if (padded.includes(` ${phrase} `) || padded.includes(` ${phrase}s `)) return category;
  }
  const words = normalized.split(" ").filter((word) => word.length > 1 && !/^\d/.test(word));
  if (words.length === 0) return null;
  return lookupWord(words[0]) ?? words.slice(1).map(lookupWord).find(Boolean) ?? null;
}

/** O nome como chave do que a lista aprendeu: sem quantidade, acento e plural simples. */
export function learnedKey(name: string): string {
  return normalizeName(parseQuantity(name).text)
    .split(" ")
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
    .join(" ");
}

export type CategoryGuesser = (name: string) => string | null;

/**
 * Monta o adivinhador da lista. `known` vem do mais antigo ao mais recente
 * (o uso mais recente vence). "Outros" não ensina nada.
 */
export function categoryGuesser(known: { text: string; category: string }[], categories: string[]): CategoryGuesser {
  const available = new Map(categories.map((category) => [category.toLowerCase(), category]));
  const learned = new Map<string, string>();
  for (const entry of known) {
    if (entry.category === DEFAULT_CATEGORY) continue;
    const category = available.get(entry.category.toLowerCase());
    if (category) learned.set(learnedKey(entry.text), category);
  }
  return (name) => {
    const fromList = learned.get(learnedKey(name));
    if (fromList) return fromList;
    const guess = dictionaryCategory(name);
    return guess ? (available.get(guess.toLowerCase()) ?? null) : null;
  };
}
