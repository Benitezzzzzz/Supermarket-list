import type { ThemeChoice } from "../theme";
import { BottomSheet } from "../ui/BottomSheet";
import { Icon, type IconName } from "../ui/Icon";

const THEMES: { value: ThemeChoice; label: string; note: string; icon: IconName }[] = [
  { value: "auto", label: "Automático", note: "igual ao aparelho", icon: "phone" },
  { value: "light", label: "Claro", note: "sempre", icon: "sun" },
  { value: "dark", label: "Escuro", note: "sempre", icon: "moon" },
];

interface DisplaySheetProps {
  theme: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  /** Modo mercado: só aparece quando o navegador sabe manter a tela acesa. */
  keepAwake?: { enabled: boolean; toggle: () => void };
  onClose: () => void;
}

/** Aberto pelo botão de sol/lua do cabeçalho: tema claro, escuro ou automático, e o modo mercado. */
export function DisplaySheet({ theme, onThemeChange, keepAwake, onClose }: DisplaySheetProps) {
  return (
    <BottomSheet title="Tema e tela" onClose={onClose}>
      <fieldset className="theme-picker">
        <legend className="field-label">Tema</legend>
        {THEMES.map((option) => (
          <label key={option.value} className="theme-option">
            <input
              type="radio"
              className="visually-hidden"
              name="tema"
              value={option.value}
              checked={theme === option.value}
              onChange={() => onThemeChange(option.value)}
            />
            <Icon name={option.icon} size={22} />
            <span className="theme-option__label">{option.label}</span>
            <span className="theme-option__note">{option.note}</span>
          </label>
        ))}
        <p className="hint theme-picker__hint">Vale só neste aparelho.</p>
      </fieldset>

      {keepAwake && (
        <button
          type="button"
          role="switch"
          className="setting-switch"
          aria-checked={keepAwake.enabled}
          onClick={keepAwake.toggle}
        >
          <span className="setting-switch__text">
            <span className="setting-switch__label">Modo mercado</span>
            <span className="setting-switch__note">Mantém a tela acesa enquanto a lista está aberta.</span>
          </span>
          <span className="setting-switch__track" aria-hidden="true">
            <span className="setting-switch__thumb" />
          </span>
        </button>
      )}
    </BottomSheet>
  );
}
