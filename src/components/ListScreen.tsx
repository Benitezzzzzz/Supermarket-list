import { type CSSProperties, useState } from "react";
import type { ListState } from "../data/syncedList";
import { groupByCategory } from "../domain/categories";
import { categoryStyle } from "../domain/categoryStyle";
import type { PricePoint } from "../domain/prices";
import type { Item, ListSummary, Template, UserInfo } from "../domain/types";
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
  lastPrice: (text: string) => PricePoint | undefined;
  onOpenTemplates: () => void;
  onUseTemplate: (template: Template) => void;
  onAdd: () => void;
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
    <div className="items" aria-hidden="true">
      {[70, 50, 85].map((width) => (
        <div key={width} className="skeleton">
          <span className="skeleton__box" />
          <span className="skeleton__line" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}

const ALL = "";

export function ListScreen({
  state,
  user,
  current,
  onOpenLists,
  onOpenAccount,
  onToggle,
  onEdit,
  onAskClearAll,
  lastPrice,
  onOpenTemplates,
  onUseTemplate,
  onAdd,
}: ListScreenProps) {
  const standard = state.templates.find((template) => template.isDefault);
  const [filter, setFilter] = useState(ALL);
  const toBuy = state.items.filter((item) => !item.done);
  const loading = state.connection === "loading" && state.items.length === 0;
  const groups = groupByCategory(state.items);
  // A categoria escolhida pode sumir (último item removido): volta para todas.
  const active = groups.some((group) => group.category === filter) ? filter : ALL;
  const visible = active === ALL ? groups : groups.filter((group) => group.category === active);
  const done = state.items.length - toBuy.length;
  const percent = state.items.length === 0 ? 0 : Math.round((done / state.items.length) * 100);

  return (
    <div className="page page--wide">
      <header className="hero">
        <div className="hero__top">
          <SyncStatus state={state} />
          <span className="header-actions">
            <button
              type="button"
              className="icon-btn icon-btn--neutral"
              aria-label="Modelos de lista"
              title="Modelos de lista"
              onClick={onOpenTemplates}
            >
              <Icon name="copy" size={20} />
            </button>
            {state.items.length > 0 && (
              <button
                type="button"
                className="icon-btn"
                aria-label="Limpar a lista"
                title="Limpar a lista"
                onClick={onAskClearAll}
              >
                <Icon name="trash" size={20} />
              </button>
            )}
            <button type="button" className="icon-btn icon-btn--account" aria-label="Sua conta" onClick={onOpenAccount}>
              {user.displayName.charAt(0).toUpperCase()}
            </button>
          </span>
        </div>

        <div className="hero__main">
          <div className="hero__text">
            <h1 className="hero__title">
              <button
                type="button"
                className="list-switch"
                onClick={onOpenLists}
                aria-label={`Lista ${current.name}. Trocar de lista`}
              >
                <span className="list-switch__name">{current.name}</span>
                <Icon name="chevron" size={24} strokeWidth={2.6} />
              </button>
            </h1>
            <p className="hero__greeting" aria-live="polite">
              {loading ? "Carregando a lista…" : greeting(user.displayName, state.items.length, toBuy.length)}
            </p>
          </div>
          {state.items.length > 0 && (
            <div
              className="ring"
              role="img"
              aria-label={`${done} de ${state.items.length} no carrinho`}
              style={{ "--pct": percent } as CSSProperties}
            >
              <span className="ring__value">{percent}%</span>
            </div>
          )}
        </div>

        <button type="button" className="quick-add" onClick={onAdd}>
          <Icon name="plus" size={20} />
          <span className="quick-add__text">Adicionar item, ex.: 2 leite</span>
          <span className="quick-add__plus" aria-hidden="true">
            <Icon name="plus" size={20} strokeWidth={2.6} />
          </span>
        </button>
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

      {groups.length > 1 && (
        <fieldset className="chips">
          <legend className="visually-hidden">Mostrar só uma categoria</legend>
          <button type="button" className="chip" aria-pressed={active === ALL} onClick={() => setFilter(ALL)}>
            Tudo
          </button>
          {groups.map((group) => (
            <button
              key={group.category}
              type="button"
              className="chip"
              aria-pressed={active === group.category}
              onClick={() => setFilter(active === group.category ? ALL : group.category)}
            >
              <Icon name={categoryStyle(group.category).icon} size={16} />
              {group.category}
            </button>
          ))}
        </fieldset>
      )}

      {!loading && state.items.length === 0 && (
        <div className="empty">
          <span className="empty__icon" aria-hidden="true">
            <Icon name="cart" size={32} />
          </span>
          <h2 className="empty__title">Lista vazia</h2>
          {standard ? (
            <>
              <p className="hint">Comece pelo seu modelo padrão ou toque em Adicionar.</p>
              <button type="button" className="btn btn--primary" onClick={() => onUseTemplate(standard)}>
                <Icon name="star" size={20} />
                Usar “{standard.name}”
              </button>
              {state.templates.length > 1 && (
                <button type="button" className="btn btn--link" onClick={onOpenTemplates}>
                  Escolher outro modelo
                </button>
              )}
            </>
          ) : state.templates.length > 0 ? (
            <>
              <p className="hint">Toque em Adicionar ou comece por um modelo.</p>
              <button type="button" className="btn btn--secondary" onClick={onOpenTemplates}>
                <Icon name="copy" size={20} />
                Escolher um modelo
              </button>
            </>
          ) : (
            <p className="hint">Toque em Adicionar para começar. Depois dá para salvar a lista como modelo.</p>
          )}
        </div>
      )}

      <div className="categories">
        {visible.map((group) => {
          const style = categoryStyle(group.category);
          const left = group.items.filter((item) => !item.done).length;
          return (
            <section key={group.category} className="group" aria-label={group.category}>
              <h2 className="group__header">
                <span className={`cat-icon ${style.tone}`} aria-hidden="true">
                  <Icon name={style.icon} size={18} />
                </span>
                <span className="group__name">{group.category}</span>
                {left > 0 ? (
                  <span className="group__count">
                    {left}
                    <span className="visually-hidden">{left === 1 ? " falta" : " faltam"}</span>
                  </span>
                ) : (
                  <span className="group__done">
                    <Icon name="check" size={16} strokeWidth={3} />
                    <span className="visually-hidden"> tudo comprado</span>
                  </span>
                )}
              </h2>
              <ul className="items">
                {group.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    lastPrice={lastPrice(item.text)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
