import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { bootStoredTheme } from "./theme/themeMode";
import "./styles/globals.css";

bootStoredTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
