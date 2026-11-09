import { type FormEvent, useMemo, useState } from "react";
import { describeItem, parseImport } from "../domain/items";
import type { Item } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { CategoryOptions } from "./CategoryOptions";

interface ImportSheetProps {
  categories: string[];
  initialCategory: string;
  /** Nome da lista que recebe os itens, para ninguém importar na lista errada. */
  listName?: string;
  initialText?: string;
  onImport: (items: Item[]) => void;
  onClose: () => void;
}

function groupByCategory(items: Item[]): [string, Item[]][] {
  const groups = new Map<string, Item[]>();
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  return [...groups];
}

const canReadClipboard = () => typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

export function ImportSheet({ categories, initialCategory, listName, initialText = "", onImport, onClose }: ImportSheetProps) {
  const [text, setText] = useState(initialText);
  const [category, setCategory] = useState(initialCategory);
  const [pasteError, setPasteError] = useState(false);
  const items = useMemo(() => parseImport(text, categories, category), [text, categories, category]);
  const groups = groupByCategory(items);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (items.length > 0) onImport(items);
  }

  async function paste() {
    try {
      const copied = await navigator.clipboard.readText();
      setPasteError(false);
      setText((previous) => (previous.trim() ? `${previous}\n${copied}` : copied));
    } catch {
      setPasteError(true);
    }
  }

  return (
    <BottomSheet title="Colar vários itens" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="hint">
          Copie a mensagem do WhatsApp e cole aqui. Data, nome de quem mandou, emojis e marcadores são
          ignorados. Um item por linha ou separados por vírgula; "Arroz x2" entra como 2 arroz.
        </p>
        <label htmlFor="importar-itens" className="field-label">
          Itens
        </label>
        <textarea
          id="importar-itens"
          className="field"
          rows={6}
          placeholder={"Hortifruti\nBanana\n2 maçãs\n\nLimpeza\nDetergente, sabão x2"}
          data-autofocus
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        {canReadClipboard() && (
          <button type="button" className="btn btn--secondary btn--block" onClick={() => void paste()}>
            Colar o que copiei
          </button>
        )}
        {pasteError && (
          <p className="hint" role="alert">
            Não consegui ler o que foi copiado. Toque e segure no campo acima e escolha "Colar".
          </p>
        )}
        <label htmlFor="importar-categoria" className="field-label">
          Categoria dos itens sem título
        </label>
        <select
          id="importar-categoria"
          className="field"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <CategoryOptions categories={categories} />
        </select>

        {items.length > 0 && (
          <section className="import-preview" aria-label="O que vai entrar">
            <h3 className="field-label">
              {listName ? `Vai entrar na lista ${listName}` : "Vai entrar na lista"}
            </h3>
            {groups.map(([name, group]) => (
              <div key={name} className="import-preview__group">
                <h4 className="import-preview__category">{name}</h4>
                <ul className="import-preview__items">
                  {group.map((item) => (
                    <li key={item.id}>{describeItem(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <button
          type="submit"
          className="btn btn--primary btn--block btn--xl"
          disabled={items.length === 0}
        >
          {items.length === 1 ? "Importar 1 item" : `Importar ${items.length} itens`}
        </button>
      </form>
    </BottomSheet>
  );
}
