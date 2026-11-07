import { Icon, type IconName } from "../ui/Icon";

export type Screen = "list" | "expenses" | "family";

interface BottomNavProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}

const TABS: { screen: Screen; label: string; icon: IconName }[] = [
  { screen: "list", label: "Lista", icon: "list" },
  { screen: "expenses", label: "Gastos", icon: "receipt" },
  { screen: "family", label: "Participantes", icon: "family" },
];

/** Sempre com texto embaixo do ícone. Adicionar fica num botão flutuante, na tela da lista. */
export function BottomNav({ screen, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav__inner">
        {TABS.map((tab) => (
          <button
            key={tab.screen}
            type="button"
            className="nav-btn"
            aria-current={screen === tab.screen ? "page" : undefined}
            onClick={() => onNavigate(tab.screen)}
          >
            <Icon name={tab.icon} size={26} />
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
