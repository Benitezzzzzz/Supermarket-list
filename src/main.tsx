import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { keepAppUpdated } from "./pwa";
import { Root } from "./Root";
import { captureSharedText } from "./sharedText";
import { applyTheme, followSystemTheme } from "./theme";
import "./styles/tokens.css";
import "./styles/app.css";

applyTheme();
followSystemTheme();
keepAppUpdated();
captureSharedText();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
