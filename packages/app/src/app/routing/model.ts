import type { ToolOperation } from "@features/tools/model.ts";

export type WalletSheet = "create" | "connect";
export type CardSheet = "edit" | "share" | "connect";
export type PersonSheet = "edit" | "share";
export type SettingsSheet = "backup" | "restore" | "appearance" | "help" | "reset";

export type Route =
  | { readonly page: "wallet"; readonly cardId?: string; readonly sheet?: WalletSheet }
  | { readonly page: "card"; readonly cardId: string; readonly sheet?: CardSheet }
  | { readonly page: "people"; readonly sheet?: never; readonly profile?: never }
  | { readonly page: "people"; readonly sheet: "add"; readonly profile?: string }
  | { readonly page: "person"; readonly contactId: string; readonly sheet?: PersonSheet }
  | { readonly page: "activity" }
  | { readonly page: "tools"; readonly operation: ToolOperation }
  | { readonly page: "settings"; readonly sheet?: SettingsSheet };

export const DEFAULT_ROUTE: Route = { page: "wallet" };
export const BASE64URL = /^[A-Za-z0-9_-]+$/;
export const MAX_PROFILE_LENGTH = 12_000;
