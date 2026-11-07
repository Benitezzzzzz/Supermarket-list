import type { ListState } from "../data/syncedList";
import { groupByCategory } from "../domain/categories";
import { categoryStyle } from "../domain/categoryStyle";
import type { Item, SessionInfo } from "../domain/types";
import { Icon } from "../ui/Icon";
import { ItemRow } from "./ItemRow";

interface ListScreenProps {
  state: ListState;
  session: SessionInfo;
  onToggle: (item: Item) => void;
  onEdit: (item: Item) => void;
  onAskClear: () => void;
  onAskClearAll: () => void;
  onFinish: () => void;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function greeting(name: string, total: number, toBuy: number): string {
  const hello = `Oi, ${firstName(name)}!`;
  if (total === 0) return `${hello} Sua lista está vazia.`;
  if (toBuy === 0) return `${hello} Tudo comprado.`;
  return toBuy === 1 ? `${hello} Falta 1 item.` : `${hello} Faltam ${toBuy} itens.`;
}

function SyncStatus({ state }: { state: ListState }) {
  if (state.connection === "offline") return <span className="sync sync--offline">Sem internet</span>;
  if (state.pendingCount > 0) return <span className="sync sync--pending">Enviando…</span>;
  if (state.connection === "loading") return <span className="sync sync--pending">Conectando…</span>;
  return <span className="sync">Sincronizado</span>;
}

function LoadingList() {
  return (
    <div className="categories" aria-hidden="true">
      {[70, 50, 85].map((width) => (
        <div key={width} className="skeleton">
          <span className="skeleton__box" />
          <span className="skeleton__line" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}

export function ListScreen({
  state,
  session,
  onToggle,
  onEdit,
  onAskClear,
  onAskClearAll,
  onFinish,
}: ListScreenProps) {
  const toBuy = state.items.filter((item) => !item.done);
  const bought = state.items.filter((item) => item.done);
  const loading = state.connection === "loading" && state.items.length === 0;

  return (
    <div className="page page--wide">
      <header className="screen-header">
        <div className="screen-header__meta">
          <SyncStatus state={state} />
          {state.items.length > 0 && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Limpar a lista toda"
              title="Limpar a lista toda"
              onClick={onAskClearAll}
            >
              <Icon name="trash" size={22} />
            </button>
          )}
        </div>
        <h1 className="title">Lista do Mercado</h1>
        <p className="subtitle" aria-live="polite">
          {loading ? "Carregando a lista…" : greeting(session.name, state.items.length, toBuy.length)}
        </p>
      </header>

      {state.connection === "offline" && (
        <p className="banner banner--warning">
          Sem internet agora. Pode continuar usando: a lista se atualiza quando a conexão voltar.
        </p>
      )}
      {state.rejected && (
        <p className="banner banner--danger">Uma alteração não foi aceita pelo servidor. Confira a lista.</p>
      )}

      {loading && <LoadingList />}

      {!loading && state.items.length === 0 && (
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            <Icon name="cart" size={32} />
          </span>
          <h2 className="empty__title">Lista vazia</h2>
          <p className="hint">Toque em Adicionar para começar.</p>
        </div>
      )}

      {!loading && state.items.length > 0 && toBuy.length === 0 && (
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            <Icon name="check" size={32} />
          </span>
          <h2 className="empty__title">Tudo comprado!</h2>
          <p className="hint">Toque em Adicionar para colocar mais itens.</p>
        </div>
      )}

      <div className="categories">
        {groupByCategory(toBuy).map((group) => {
          const style = categoryStyle(group.category);
          return (
            <section key={group.category} className="card" aria-label={group.category}>
              <h2 className="card__header">
                <span className={`cat-icon ${style.tone}`} aria-hidden="true">
                  <Icon name={style.icon} size={20} />
                </span>
                <span className="card__name">{group.category}</span>
                <span className="card__count">{group.items.length}</span>
              </h2>
              <ul className="items">
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />
                ))}
              </ul>
            </section>
          );
        })}

        {bought.length > 0 && (
          <section className="cart" aria-labelledby="carrinho">
            <div className="cart__header">
              <h2 id="carrinho" className="cart__title">
                No carrinho · {bought.length}
              </h2>
              <button
                type="button"
                className="cart__clear"
                aria-label="Limpar o carrinho"
                onClick={onAskClear}
              >
                Limpar
              </button>
            </div>
            <ul className="items">
              {bought.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={onToggle} />
              ))}
            </ul>
          </section>
        )}
      </div>

      {state.items.length > 0 && (
        <button type="button" className="btn btn--accent btn--block btn--xl" onClick={onFinish}>
          <Icon name="bag" size={24} />
          Finalizar compra
        </button>
      )}
    </div>
  );
}
