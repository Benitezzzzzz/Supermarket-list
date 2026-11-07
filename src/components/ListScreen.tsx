import type { ListState } from "../data/syncedList";
import { groupByCategory } from "../domain/categories";
import { categoryStyle } from "../domain/categoryStyle";
import type { Item, ListSummary, UserInfo } from "../domain/types";
import { Icon } from "../ui/Icon";
import { ItemRow } from "./ItemRow";

interface ListScreenProps {
  state: ListState;
  user: UserInfo;
  current: ListSummary;
  onOpenLists: () => void;
  onOpenAccount: () => void;
  onToggle: (item: Item) => void;
  onEdit: (item: Item) => void;
  onAskClearAll: () => void;
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
  user,
  current,
  onOpenLists,
  onOpenAccount,
  onToggle,
  onEdit,
  onAskClearAll,
}: ListScreenProps) {
  const toBuy = state.items.filter((item) => !item.done);
  const loading = state.connection === "loading" && state.items.length === 0;

  return (
    <div className="page page--wide">
      <header className="screen-header">
        <div className="screen-header__meta">
          <SyncStatus state={state} />
          <span className="header-actions">
            {state.items.length > 0 && (
              <button
                type="button"
                className="icon-btn"
                aria-label="Limpar a lista"
                title="Limpar a lista"
                onClick={onAskClearAll}
              >
                <Icon name="trash" size={22} />
              </button>
            )}
            <button type="button" className="icon-btn icon-btn--account" aria-label="Sua conta" onClick={onOpenAccount}>
              {user.displayName.charAt(0).toUpperCase()}
            </button>
          </span>
        </div>
        <h1 className="title">
          <button type="button" className="list-switch" onClick={onOpenLists} aria-label={`Lista ${current.name}. Trocar de lista`}>
            <span className="list-switch__name">{current.name}</span>
            <Icon name="chevron" size={26} strokeWidth={2.6} />
          </button>
        </h1>
        <p className="subtitle" aria-live="polite">
          {loading ? "Carregando a lista…" : greeting(user.displayName, state.items.length, toBuy.length)}
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

      <div className="categories">
        {groupByCategory(state.items).map((group) => {
          const style = categoryStyle(group.category);
          const left = group.items.filter((item) => !item.done).length;
          return (
            <section key={group.category} className="card" aria-label={group.category}>
              <h2 className="card__header">
                <span className={`cat-icon ${style.tone}`} aria-hidden="true">
                  <Icon name={style.icon} size={20} />
                </span>
                <span className="card__name">{group.category}</span>
                {left > 0 ? (
                  <span className="card__count">
                    {left}
                    <span className="visually-hidden">{left === 1 ? " falta" : " faltam"}</span>
                  </span>
                ) : (
                  <span className="card__done">
                    <Icon name="check" size={20} strokeWidth={3} />
                    <span className="visually-hidden"> tudo comprado</span>
                  </span>
                )}
              </h2>
              <ul className="items">
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} onToggle={onToggle} onEdit={onEdit} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

    </div>
  );
}
