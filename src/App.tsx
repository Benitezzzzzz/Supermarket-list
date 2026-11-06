import { useEffect, useState, useSyncExternalStore } from "react";
import { AddForm } from "./components/AddForm";
import { FamilyPanel } from "./components/FamilyPanel";
import { ImportPanel } from "./components/ImportPanel";
import { ItemRow } from "./components/ItemRow";
import { JoinScreen } from "./components/JoinScreen";
import type { SyncedList } from "./data/syncedList";
import { DEFAULT_CATEGORY, groupByCategory, knownCategories } from "./domain/categories";
import { createItem } from "./domain/items";
import type { SessionInfo } from "./domain/types";

interface AppProps {
  list: SyncedList;
  session: SessionInfo;
  onRejoined: (session: SessionInfo) => void;
}

type OpenPanel = "import" | "family" | null;

function statusText(loading: boolean, total: number, toBuy: number): string {
  if (loading && total === 0) return "Carregando…";
  if (total === 0) return "Lista vazia";
  if (toBuy === 0) return "Tudo comprado! ✅";
  return toBuy === 1 ? "1 item para comprar" : `${toBuy} itens para comprar`;
}

export function App({ list, session, onRejoined }: AppProps) {
  const state = useSyncExternalStore(list.subscribe, list.getState);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [panel, setPanel] = useState<OpenPanel>(null);

  useEffect(() => list.start(), [list]);

  if (state.accessRevoked) return <JoinScreen revoked onJoined={onRejoined} />;

  const categories = knownCategories(state.customCategories, state.items);
  const toBuy = state.items.filter((item) => !item.done);
  const bought = state.items.filter((item) => item.done);

  function createCategory(name: string) {
    const existing = categories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (!existing) list.addCategory(name);
    setSelectedCategory(existing ?? name);
  }

  const togglePanel = (target: OpenPanel) => setPanel(panel === target ? null : target);

  const rowProps = {
    categories,
    onUpdate: (id: string, changes: Parameters<SyncedList["updateItem"]>[1]) =>
      list.updateItem(id, changes),
    onDelete: (id: string) => list.removeItems([id]),
  };

  return (
    <div className="page">
      <header className="top">
        <h1>Lista do Mercado</h1>
        <p id="status" aria-live="polite">
          {statusText(state.connection === "loading", state.items.length, toBuy.length)}
        </p>
      </header>

      {state.connection === "offline" && (
        <div className="banner info">
          Sem conexão. Pode continuar usando: as alterações são enviadas quando a internet voltar.
        </div>
      )}
      {state.rejected && (
        <div className="banner">Uma alteração não foi aceita pelo servidor. Confira a lista.</div>
      )}

      <AddForm
        categories={categories}
        category={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onCreateCategory={createCategory}
        onAdd={(text) => list.addItems([createItem(text, selectedCategory)])}
      />

      <div className="links-row">
        <button type="button" className="link-btn" onClick={() => togglePanel("import")}>
          Importar lista
        </button>
        <button type="button" className="link-btn" onClick={() => togglePanel("family")}>
          Família
        </button>
      </div>
      {panel === "import" && (
        <ImportPanel
          categories={categories}
          initialCategory={selectedCategory}
          onImport={(items) => {
            list.addItems(items);
            setPanel(null);
          }}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === "family" && <FamilyPanel session={session} />}

      <section className="card">
        <h2>Para comprar</h2>
        {groupByCategory(toBuy).map((group) => (
          <div className="cat-group" key={group.category}>
            <h3 className="cat-heading">{group.category}</h3>
            <ul className="list">
              {group.items.map((item) => (
                <ItemRow key={item.id} item={item} {...rowProps} />
              ))}
            </ul>
          </div>
        ))}
        {state.items.length === 0 && state.connection !== "loading" && (
          <div className="empty">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h2l2.4 12.2a2 2 0 0 0 2 1.8h7.2a2 2 0 0 0 2-1.6L21 9H7" />
              <circle cx="10" cy="21" r="1" />
              <circle cx="17" cy="21" r="1" />
            </svg>
            <div>
              Sua lista está vazia.
              <br />
              Adicione o primeiro item ali em cima!
            </div>
          </div>
        )}
      </section>

      {bought.length > 0 && (
        <>
          <section className="card" id="boughtSection">
            <h2>Já comprado</h2>
            <ul className="list">
              {bought.map((item) => (
                <ItemRow key={item.id} item={item} {...rowProps} />
              ))}
            </ul>
          </section>
          <div className="footer-actions">
            <button
              id="clearBought"
              type="button"
              onClick={() => list.removeItems(bought.map((item) => item.id))}
            >
              Limpar comprados
            </button>
          </div>
        </>
      )}
    </div>
  );
}
