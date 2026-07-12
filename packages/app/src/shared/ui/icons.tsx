import { PROVIDER_META, type ProviderId } from "@keychain/core";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  KeyRound,
  Link,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Settings,
  Share,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import type { ReactElement } from "react";

export const PlusIcon = ({
  stroke = "currentColor",
  size = 22,
  width = 2.4,
}: {
  stroke?: string;
  size?: number;
  width?: number;
}): ReactElement => <Plus aria-hidden="true" color={stroke} size={size} strokeWidth={width} />;

export const BackIcon = (): ReactElement => (
  <ArrowLeft aria-hidden="true" color="#fff" size={20} strokeWidth={2.4} />
);

export const EditIcon = ({ stroke = "#fff" }: { stroke?: string } = {}): ReactElement => (
  <Pencil aria-hidden="true" color={stroke} size={19} strokeWidth={2} />
);

export const SearchIcon = ({ stroke = "currentColor" }: { stroke?: string } = {}): ReactElement => (
  <Search aria-hidden="true" color={stroke} size={19} strokeWidth={2} />
);

export const TrashIcon = ({ stroke = "currentColor" }: { stroke?: string } = {}): ReactElement => (
  <Trash2 aria-hidden="true" color={stroke} size={19} strokeWidth={2} />
);

export const ShareIcon = ({ stroke = "#E8502A" }: { stroke?: string }): ReactElement => (
  <Share aria-hidden="true" color={stroke} size={19} strokeWidth={2} />
);

export const ShieldIcon = ({
  size = 19,
  width = 2,
}: {
  size?: number;
  width?: number;
}): ReactElement => (
  <ShieldCheck aria-hidden="true" color="#2E6BE6" size={size} strokeWidth={width} />
);

export const CheckIcon = ({
  size = 12,
  stroke = "#28B463",
  width = 3.4,
}: {
  size?: number;
  stroke?: string;
  width?: number;
}): ReactElement => <Check aria-hidden="true" color={stroke} size={size} strokeWidth={width} />;

export const ChevronIcon = ({ size = 18 }: { size?: number }): ReactElement => (
  <ChevronRight aria-hidden="true" color="#C9BBA6" size={size} strokeWidth={2.2} />
);

export const CopyIcon = (): ReactElement => (
  <Copy aria-hidden="true" color="#C9BBA6" size={18} strokeWidth={2} />
);

export const LockIcon = (): ReactElement => (
  <LockKeyhole aria-hidden="true" color="currentColor" size={18} strokeWidth={2.2} />
);

export const KeyIcon = (): ReactElement => (
  <KeyRound aria-hidden="true" color="currentColor" size={18} strokeWidth={2.2} />
);

export const PersonIcon = (): ReactElement => (
  <UserRound aria-hidden="true" color="#fff" size={30} strokeWidth={1.6} style={{ opacity: 0.9 }} />
);

export const LinkIcon = (): ReactElement => (
  <Link aria-hidden="true" color="#2E6BE6" size={18} strokeWidth={2} />
);

export type NavIconKind = "wallet" | "people" | "clock" | "tools" | "gear";

export const NavIcon = ({ kind, active }: { kind: NavIconKind; active: boolean }): ReactElement => {
  const props = {
    "aria-hidden": true,
    color: active ? "#E8502A" : "#B3A691",
    size: 24,
    strokeWidth: active ? 2.2 : 2,
  } as const;
  switch (kind) {
    case "wallet":
      return <WalletCards {...props} />;
    case "clock":
      return <Clock3 {...props} />;
    case "tools":
      return <Wrench {...props} />;
    case "gear":
      return <Settings {...props} />;
    case "people":
      return <UsersRound {...props} />;
  }
};

/** Brand marks for identity providers. */
export const ProviderIcon = ({
  provider,
  size = 22,
}: {
  provider: ProviderId;
  size?: number;
}): ReactElement => {
  const col = PROVIDER_META[provider].fg;
  switch (provider) {
    case "twitter":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={col} role="img" aria-label="X">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      );
    case "github":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={col}
          role="img"
          aria-label="GitHub"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.33-1.73-1.33-1.73-1.09-.73.08-.72.08-.72 1.2.08 1.83 1.21 1.83 1.21 1.07 1.79 2.81 1.27 3.5.97.11-.76.42-1.27.76-1.56-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.5 11.5 0 016 0c2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.36.81 1.09.81 2.2 0 1.59-.01 2.87-.01 3.26 0 .31.22.68.83.56A12.02 12.02 0 0024 12.29C24 5.78 18.63.5 12 .5Z"
          />
        </svg>
      );
    case "facebook":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={col}
          role="img"
          aria-label="Facebook"
        >
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07Z" />
        </svg>
      );
    case "reddit":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          role="img"
          aria-label="Reddit"
        >
          <circle cx="16.5" cy="6.5" r="1.7" fill={col} />
          <path d="M16.5 8.1L14.4 12" stroke={col} strokeWidth="1.3" strokeLinecap="round" />
          <ellipse cx="12" cy="15" rx="8" ry="5.2" fill={col} />
          <circle cx="9" cy="14.6" r="1.25" fill="#fff" />
          <circle cx="15" cy="14.6" r="1.25" fill="#fff" />
          <path d="M9 17.6c.9.7 4.1.7 6 0" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "slack":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          role="img"
          aria-label="Slack"
        >
          <path d="M6 15a2 2 0 11-2-2h2v2Zm1 0a2 2 0 014 0v5a2 2 0 11-4 0v-5Z" fill="#E01E5A" />
          <path d="M9 6a2 2 0 11-2 2V6h2Zm0 1a2 2 0 010 4H4a2 2 0 110-4h5Z" fill="#36C5F0" />
          <path d="M18 9a2 2 0 112 2h-2V9Zm-1 0a2 2 0 01-4 0V4a2 2 0 114 0v5Z" fill="#2EB67D" />
          <path d="M15 18a2 2 0 11-2-2h2v2Zm0-1a2 2 0 010-4h5a2 2 0 110 4h-5Z" fill="#ECB22E" />
        </svg>
      );
    case "confluence":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          role="img"
          aria-label="Confluence"
        >
          <path
            d="M4.3 16.4c-.2.3-.1.7.2.9l3 1.9c.3.2.7.1.9-.2 2.4-4 4.4-3.5 8-1.8l3 1.4c.3.2.7 0 .9-.3l1.5-3.3c.1-.3 0-.7-.3-.8-6.4-3-11.8-2.6-15.2 2.2Z"
            fill="#2684FF"
          />
          <path
            d="M19.7 7.6c.2-.3.1-.7-.2-.9l-3-1.9c-.3-.2-.7-.1-.9.2-2.4 4-4.4 3.5-8 1.8l-3-1.4c-.3-.2-.7 0-.9.3L2.2 9c-.1.3 0 .7.3.8 6.4 3 11.8 2.6 15.2-2.2Z"
            fill="#0052CC"
          />
        </svg>
      );
    case "email":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          role="img"
          aria-label="Email"
        >
          <rect x="3" y="5" width="18" height="14" rx="3" stroke={col} strokeWidth="2" />
          <path
            d="M4 7.5l8 5.5 8-5.5"
            stroke={col}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
