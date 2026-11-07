import { Icon } from "../ui/Icon";

export type Screen = "list" | "family";

interface BottomNavProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onAdd: () => void;
}

/** Sempre com texto embaixo do ícone, e o botão de adicionar no centro, no alcance do polegar. */
export function BottomNav({ screen, onNavigate, onAdd }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav__inner">
        <button
          type="button"
          className="nav-btn"
          aria-current={screen === "list" ? "page" : undefined}
          onClick={() => onNavigate("list")}
        >
          <Icon name="list" size={26} />
          Lista
        </button>
        <button type="button" className="nav-btn nav-btn--add" onClick={onAdd}>
          <Icon name="plus" size={28} strokeWidth={2.6} />
          Adicionar
        </button>
        <button
          type="button"
          className="nav-btn"
          aria-current={screen === "family" ? "page" : undefined}
          onClick={() => onNavigate("family")}
        >
          <Icon name="family" size={26} />
          Família
        </button>
      </div>
    </nav>
  );
}
