import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(<App />);

const registerServiceWorker = (): void => {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

  const register = (): void => {
    void navigator.serviceWorker
      .register(new URL("./sw.js", document.baseURI), { scope: "./", type: "module" })
      .catch((error: unknown) => console.error("Service worker registration failed", error));
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
};

registerServiceWorker();
