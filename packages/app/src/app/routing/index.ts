import { formatHashRoute } from "@app/routing/format.ts";
import { DEFAULT_ROUTE, type Route } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { activityRoute } from "@app/routing/routes/activity.route.ts";
import { cardRoute } from "@app/routing/routes/card.route.ts";
import { featuresRoute } from "@app/routing/routes/features.route.ts";
import { peopleRoute } from "@app/routing/routes/people.route.ts";
import { personRoute } from "@app/routing/routes/person.route.ts";
import { settingsRoute } from "@app/routing/routes/settings.route.ts";
import { toolRoute } from "@app/routing/routes/tool.route.ts";
import { toolsIndexRoute } from "@app/routing/routes/tools-index.route.ts";
import { walletRoute } from "@app/routing/routes/wallet.route.ts";
import { hasValidLocationEncoding } from "@app/routing/validation.ts";
import { matchRoutes } from "react-router";

const definitions: readonly RouteDefinition[] = [
  walletRoute,
  cardRoute,
  peopleRoute,
  personRoute,
  activityRoute,
  toolsIndexRoute,
  toolRoute,
  featuresRoute,
  settingsRoute,
];

export const routeFromLocation = (pathname: string, search: string): Route => {
  const rawQuery = search.startsWith("?") ? search.slice(1) : search;
  if (!hasValidLocationEncoding(pathname, rawQuery)) return DEFAULT_ROUTE;
  const match = matchRoutes(
    definitions.map(({ route }) => route),
    { pathname },
  )?.at(-1);
  const definition = definitions.find(({ route }) => route.id === match?.route.id);
  return definition?.parse(match?.params ?? {}, new URLSearchParams(rawQuery)) ?? DEFAULT_ROUTE;
};

export const parseHashRoute = (hash: string): Route => {
  if (!hash.startsWith("#/")) return DEFAULT_ROUTE;
  const question = hash.indexOf("?");
  return routeFromLocation(
    question < 0 ? hash.slice(1) : hash.slice(1, question),
    question < 0 ? "" : hash.slice(question),
  );
};

export const canonicalizeHashRoute = (hash: string): string =>
  formatHashRoute(parseHashRoute(hash));

export { formatHashRoute, routeWithoutOverlay } from "@app/routing/format.ts";
export type {
  CardSheet,
  PersonSheet,
  Route,
  SettingsSheet,
  WalletSheet,
} from "@app/routing/model.ts";
export { DEFAULT_ROUTE } from "@app/routing/model.ts";
