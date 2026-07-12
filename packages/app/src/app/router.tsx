import {
  canonicalizeHashRoute,
  DEFAULT_ROUTE,
  formatHashRoute,
  type Route,
  routeFromLocation,
  routeWithoutOverlay,
} from "@app/routing/index.ts";
import { type ReactElement, type ReactNode, useCallback, useEffect, useMemo } from "react";
import { HashRouter as ReactHashRouter, useLocation, useNavigate } from "react-router";

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

const pathFor = (route: Route): string => formatHashRoute(route).slice(1);

export interface WalletRouter {
  readonly route: Route;
  readonly push: (route: Route) => void;
  readonly replace: (route: Route) => void;
  readonly back: (fallback?: Route) => void;
  readonly closeOverlay: () => void;
}

export const useWalletRouter = (): WalletRouter => {
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(
    () => routeFromLocation(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const depth = historyDepth(location.state) ?? 0;

  const replace = useCallback(
    (next: Route): void => {
      void navigate(pathFor(next), {
        replace: true,
        state: stateWithDepth(location.state, depth),
      });
    },
    [depth, location.state, navigate],
  );

  const push = useCallback(
    (next: Route): void => {
      const path = pathFor(next);
      if (`${location.pathname}${location.search}` === path) {
        replace(next);
        return;
      }
      void navigate(path, { state: stateWithDepth(location.state, depth + 1) });
    },
    [depth, location.pathname, location.search, location.state, navigate, replace],
  );

  const back = useCallback(
    (fallback: Route = DEFAULT_ROUTE): void => {
      if (depth > 0) {
        void navigate(-1);
        return;
      }
      replace(fallback);
    },
    [depth, navigate, replace],
  );

  const closeOverlay = useCallback((): void => {
    const parent = routeWithoutOverlay(route);
    if (parent !== null) back(parent);
  }, [back, route]);

  useEffect(() => {
    const canonicalPath = pathFor(route);
    if (`${location.pathname}${location.search}` !== canonicalPath) {
      void navigate(canonicalPath, {
        replace: true,
        state: stateWithDepth(location.state, depth),
      });
    }
  }, [depth, location.pathname, location.search, location.state, navigate, route]);

  return { route, push, replace, back, closeOverlay };
};

export const WalletRouterProvider = ({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement => {
  const canonicalHash = canonicalizeHashRoute(window.location.hash);
  if (window.location.hash !== canonicalHash) {
    window.history.replaceState(window.history.state, "", canonicalHash);
  }
  return <ReactHashRouter>{children}</ReactHashRouter>;
};
