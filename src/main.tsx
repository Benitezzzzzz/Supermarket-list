import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { keepAppUpdated } from "./pwa";
import { Root } from "./Root";
import { captureSharedText } from "./sharedText";
import { applyTheme, followSystemTheme } from "./theme";
import "./styles/tokens.css";
// A ordem importa: cada arquivo pode ajustar regras dos anteriores.
import "./styles/base.css";
import "./styles/list.css";
import "./styles/expenses.css";
import "./styles/sheets.css";
import "./styles/receipt.css";
import "./styles/responsive.css";
import "./styles/print.css";

applyTheme();
followSystemTheme();
keepAppUpdated();
captureSharedText();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
