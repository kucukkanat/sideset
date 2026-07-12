import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_ROUTE,
  formatHashRoute,
  parseHashRoute,
  type Route,
  routeWithoutOverlay,
} from "./routing.ts";

const HISTORY_DEPTH_KEY = "__keychainHashRouterDepth";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const historyDepth = (state: unknown): number | null => {
  if (!isRecord(state)) return null;
  const depth = state[HISTORY_DEPTH_KEY];
  return typeof depth === "number" && Number.isSafeInteger(depth) && depth >= 0 ? depth : null;
};

const stateWithDepth = (state: unknown, depth: number): Readonly<Record<string, unknown>> => ({
  ...(isRecord(state) ? state : {}),
  [HISTORY_DEPTH_KEY]: depth,
});

const sameRoute = (left: Route, right: Route): boolean =>
  formatHashRoute(left) === formatHashRoute(right);

export interface HashRouter {
  readonly route: Route;
  readonly push: (route: Route) => void;
  readonly replace: (route: Route) => void;
  readonly back: (fallback?: Route) => void;
  readonly closeOverlay: () => void;
}

/** A tiny hash router that keeps navigation in browser history without server rewrites. */
export const useHashRouter = (): HashRouter => {
  const [route, setRoute] = useState<Route>(() => parseHashRoute(window.location.hash));

  const replace = useCallback((next: Route): void => {
    const hash = formatHashRoute(next);
    const depth = historyDepth(window.history.state) ?? 0;
    window.history.replaceState(stateWithDepth(window.history.state, depth), "", hash);
    setRoute((current) => (sameRoute(current, next) ? current : next));
  }, []);

  const push = useCallback(
    (next: Route): void => {
      const hash = formatHashRoute(next);
      if (window.location.hash === hash) {
        replace(next);
        return;
      }
      const depth = (historyDepth(window.history.state) ?? 0) + 1;
      window.history.pushState(stateWithDepth(window.history.state, depth), "", hash);
      setRoute(next);
    },
    [replace],
  );

  const back = useCallback(
    (fallback: Route = DEFAULT_ROUTE): void => {
      const depth = historyDepth(window.history.state) ?? 0;
      if (depth > 0) {
        window.history.back();
        return;
      }
      replace(fallback);
    },
    [replace],
  );

  const closeOverlay = useCallback((): void => {
    const parent = routeWithoutOverlay(route);
    if (parent !== null) back(parent);
  }, [back, route]);

  useEffect(() => {
    const syncFromLocation = (): void => {
      const next = parseHashRoute(window.location.hash);
      const canonicalHash = formatHashRoute(next);
      const depth = historyDepth(window.history.state) ?? 0;
      if (window.location.hash !== canonicalHash || historyDepth(window.history.state) === null) {
        window.history.replaceState(stateWithDepth(window.history.state, depth), "", canonicalHash);
      }
      setRoute((current) => (sameRoute(current, next) ? current : next));
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("hashchange", syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("hashchange", syncFromLocation);
    };
  }, []);

  return { route, push, replace, back, closeOverlay };
};
