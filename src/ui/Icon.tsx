const PATHS = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M5 13l4 4L19 7",
  close: "M6 6l12 12M18 6L6 18",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  family:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M17 11.5a2.5 2.5 0 1 0 0-5M16 14.6c2.3.2 3.9 1.6 4.4 4.1",
  cart: "M3 6h2l2.4 12.2a2 2 0 0 0 2 1.8h7.2a2 2 0 0 0 2-1.6L21 9H7M10 21h.01M17 21h.01",
  paste: "M9 4h6v3H9zM6 6h12v15H6z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  leaf: "M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7",
  bread: "M4 11a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4c0 1-1 1.5-2 1.7V19H6v-6.3C5 12.5 4 12 4 11z",
  fish: "M2 12c3-5 9-6 14-3l6-4v14l-6-4c-5 3-11 2-14-3zM7 11h.01",
  milk: "M8 3h8l1 4v13H7V7zM7 7h10",
  jar: "M8 3h8v3H8zM6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z",
  bottle: "M10 2h4v4l2 3v12H8V9l2-3z",
  spray: "M9 8h6v13H9zM10 8V5h4M14 5l4-2",
  drop: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z",
  snow: "M12 2v20M4 6l16 12M20 6L4 18",
  basket: "M3 9h18l-2 11H5zM8 9l4-6 4 6",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  cash: "M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 10v.01M18 14v.01",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  pix: "M12 3l9 9-9 9-9-9zM8.5 12h7",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  chevron: "M6 9l6 6 6-6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  "arrow-up": "M12 19V5M6 11l6-6 6 6",
  "arrow-down": "M12 5v14M6 13l6 6 6-6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  copy: "M8 8h12v12H8zM4 16V4h12",
  /* Planilha: os modelos de lista. */
  sheet: "M4 4h16v16H4zM4 9.5h16M4 15h16M9.5 9.5V20",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  phone: "M7 2h10v20H7zM11 18h2",
  tag: "M20.4 12.6 12 21l-9-9V4h8l9.4 9.4a2 2 0 0 1 0 2.6zM7.5 7.5h.01",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18h2",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

/** Ícones de traço desenhados no próprio app: sem biblioteca, sempre decorativos. */
export function Icon({ name, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
