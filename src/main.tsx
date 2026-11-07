import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { keepAppUpdated } from "./pwa";
import { Root } from "./Root";
import "./styles/tokens.css";
import "./styles/app.css";

keepAppUpdated();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
