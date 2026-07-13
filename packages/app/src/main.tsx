import { App } from "@app/App.tsx";
import { installServiceWorkerBuildVersionResponder } from "@app/features/acquisition.ts";
import { loadFeaturePreferences } from "@app/features/preference-storage.ts";
import { walletPreferenceInitialization } from "@app/storage.ts";
import { createRoot } from "react-dom/client";

const preferenceInitialization = walletPreferenceInitialization();
installServiceWorkerBuildVersionResponder(
  () => loadFeaturePreferences(preferenceInitialization).preferences.enabled,
);

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
