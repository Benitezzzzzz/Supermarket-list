import { useState } from "react";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
}

/** Campo de senha com botão para mostrar o que foi digitado. */
export function PasswordField({ id, label, value, onChange, autoComplete }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="invite__row">
        <input
          id={id}
          className="field"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="btn btn--secondary"
          aria-pressed={visible}
          aria-label={visible ? `Esconder ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Esconder" : "Mostrar"}
        </button>
      </div>
    </>
  );
}
