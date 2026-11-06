export function CategoryOptions({ categories }: { categories: string[] }) {
  return categories.map((category) => (
    <option key={category} value={category}>
      {category}
    </option>
  ));
}
