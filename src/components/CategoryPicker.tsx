import { useId } from "react";
import { categoryStyle } from "../domain/categoryStyle";
import { Icon } from "../ui/Icon";

interface CategoryPickerProps {
  label: string;
  categories: string[];
  value: string;
  onChange: (category: string) => void;
}

/**
 * Grade de blocos grandes com ícone e cor: mais fácil de acertar que uma lista suspensa.
 * São opções de verdade (radio), então as setas do teclado e os leitores de tela funcionam.
 */
export function CategoryPicker({ label, categories, value, onChange }: CategoryPickerProps) {
  const name = useId();
  return (
    <fieldset className="tiles">
      <legend className="visually-hidden">{label}</legend>
      {categories.map((category) => {
        const style = categoryStyle(category);
        return (
          <label key={category} className={`tile ${style.tone}`}>
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={category}
              checked={category === value}
              onChange={() => onChange(category)}
            />
            <Icon name={style.icon} size={20} />
            <span>{category}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
