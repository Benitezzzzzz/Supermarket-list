import { useState } from "react";
import { parseImport } from "../domain/items";
import type { Item } from "../domain/types";
import { CategoryOptions } from "./CategoryOptions";

interface ImportPanelProps {
  categories: string[];
  initialCategory: string;
  onImport: (items: Item[]) => void;
  onCancel: () => void;
}

export function ImportPanel({ categories, initialCategory, onImport, onCancel }: ImportPanelProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState(initialCategory);

  return (
    <div id="importPanel">
      <p className="hint">
        Cole vários itens de uma vez, um por linha. Uma linha só com o nome de uma categoria (ex.:
        "Hortifruti") vira um título e organiza os itens seguintes.
      </p>
      <textarea
        id="importText"
        rows={6}
        aria-label="Itens para importar"
        placeholder={"Hortifruti\nBanana\nTomate\n\nLimpeza\nDetergente"}
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="add-row2">
        <label htmlFor="importCat">Categoria padrão</label>
        <select
          id="importCat"
          className="cat-select-wide"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <CategoryOptions categories={categories} />
        </select>
      </div>
      <div className="import-actions">
        <button type="button" id="cancelImport" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          id="doImport"
          onClick={() => onImport(parseImport(text, categories, category))}
        >
          Importar
        </button>
      </div>
    </div>
  );
}
