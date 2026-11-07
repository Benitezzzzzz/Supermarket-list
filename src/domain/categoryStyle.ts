import type { IconName } from "../ui/Icon";

export interface CategoryStyle {
  /** Classe CSS que define as cores da categoria (tokens --cat-*). */
  tone: string;
  icon: IconName;
}

const STYLES: Record<string, CategoryStyle> = {
  Hortifruti: { tone: "tone-horti", icon: "leaf" },
  Padaria: { tone: "tone-padaria", icon: "bread" },
  "Açougue e Peixaria": { tone: "tone-acougue", icon: "fish" },
  "Laticínios e Frios": { tone: "tone-laticinios", icon: "milk" },
  Mercearia: { tone: "tone-mercearia", icon: "jar" },
  Bebidas: { tone: "tone-bebidas", icon: "bottle" },
  Limpeza: { tone: "tone-limpeza", icon: "spray" },
  "Higiene e Farmácia": { tone: "tone-higiene", icon: "drop" },
  Congelados: { tone: "tone-congelados", icon: "snow" },
  Outros: { tone: "tone-outros", icon: "basket" },
};

const CUSTOM: CategoryStyle = { tone: "tone-custom", icon: "tag" };

/** Categorias criadas pela família recebem um estilo neutro próprio. */
export function categoryStyle(category: string): CategoryStyle {
  return STYLES[category] ?? CUSTOM;
}

const MEMBER_TONES = ["tone-horti", "tone-padaria", "tone-laticinios", "tone-higiene", "tone-limpeza"];

/** Cor estável por pessoa, para o avatar não mudar de cor entre aberturas. */
export function memberTone(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return MEMBER_TONES[hash % MEMBER_TONES.length];
}
