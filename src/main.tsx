import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { getState, setState } from "./store";

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__atlas = { getState, setState };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
