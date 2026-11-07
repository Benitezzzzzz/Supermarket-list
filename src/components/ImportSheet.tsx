import { type FormEvent, useState } from "react";
import { parseImport } from "../domain/items";
import type { Item } from "../domain/types";
import { BottomSheet } from "../ui/BottomSheet";
import { CategoryOptions } from "./CategoryOptions";

interface ImportSheetProps {
  categories: string[];
  initialCategory: string;
  onImport: (items: Item[]) => void;
  onClose: () => void;
}

export function ImportSheet({ categories, initialCategory, onImport, onClose }: ImportSheetProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const items = parseImport(text, categories, category);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (items.length > 0) onImport(items);
  }

  return (
    <BottomSheet title="Colar vários itens" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="hint">
          Um item por linha. Se uma linha for o nome de uma categoria (ex.: "Hortifruti"), os itens
          abaixo vão para ela.
        </p>
        <label htmlFor="importar-itens" className="field-label">
          Itens
        </label>
        <textarea
          id="importar-itens"
          className="field"
          rows={6}
          placeholder={"Hortifruti\nBanana\n2 maçãs\n\nLimpeza\nDetergente"}
          data-autofocus
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
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
