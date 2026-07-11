import { PROVIDER_META, type ProviderId } from "@keychain/core";
import type { ReactElement } from "react";

export const ScanIcon = (): ReactElement => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" role="img" aria-label="Scan">
    <path
      d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16"
      stroke="#1B1917"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M7 12h10" stroke="#E8502A" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const PlusIcon = ({
  stroke = "#A08E78",
  size = 22,
  width = 2.4,
}: {
  stroke?: string;
  size?: number;
  width?: number;
}): ReactElement => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label="Add">
    <path d="M12 5v14M5 12h14" stroke={stroke} strokeWidth={width} strokeLinecap="round" />
  </svg>
);

export const BackIcon = (): ReactElement => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" role="img" aria-label="Back">
    <path
      d="M15 6l-6 6 6 6"
      stroke="#fff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EditIcon = (): ReactElement => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" role="img" aria-label="Edit">
    <path
      d="M4 20h4L18.5 9.5a2.1 2.1 0 00-3-3L5 17v3z"
      stroke="#fff"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export const ShareIcon = ({ stroke = "#E8502A" }: { stroke?: string }): ReactElement => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" role="img" aria-label="Share">
    <path
      d="M12 15V4m0 0L8 8m4-4l4 4"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const ShieldIcon = ({
  size = 19,
  width = 2,
}: {
  size?: number;
  width?: number;
}): ReactElement => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label="Backup">
    <path
      d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z"
      stroke="#2E6BE6"
      strokeWidth={width}
      strokeLinejoin="round"
    />
    <path
      d="M9 12l2 2 4-4"
      stroke="#2E6BE6"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CheckIcon = ({
  size = 12,
  stroke = "#28B463",
  width = 3.4,
}: {
  size?: number;
  stroke?: string;
  width?: number;
}): ReactElement => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label="Verified">
    <path
      d="M5 13l4 4 10-10"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronIcon = ({ size = 18 }: { size?: number }): ReactElement => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label="Open">
    <path
      d="M9 6l6 6-6 6"
      stroke="#C9BBA6"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CopyIcon = (): ReactElement => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="img" aria-label="Copy">
    <rect x="8" y="8" width="12" height="12" rx="3" stroke="#C9BBA6" strokeWidth="2" />
    <path
      d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"
      stroke="#C9BBA6"
      strokeWidth="2"
    />
  </svg>
);

export const MessageIcon = (): ReactElement => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" role="img" aria-label="Message">
    <path d="M4 5h16v11H8l-4 4V5z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export const PersonIcon = (): ReactElement => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 24 24"
    fill="none"
    style={{ opacity: 0.9 }}
    role="img"
    aria-label="Identity"
  >
    <circle cx="12" cy="8" r="3.4" stroke="#fff" strokeWidth="1.6" />
    <path
      d="M5.5 19c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const LinkIcon = (): ReactElement => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="img" aria-label="Link">
    <path
      d="M9 15l6-6M8 8H6a4 4 0 000 8h2m8-8h2a4 4 0 010 8h-2"
      stroke="#2E6BE6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export type NavIconKind = "wallet" | "people" | "clock" | "gear";

export const NavIcon = ({ kind, active }: { kind: NavIconKind; active: boolean }): ReactElement => {
  const col = active ? "#E8502A" : "#B3A691";
  const sw = active ? 2.2 : 2;
  switch (kind) {
    case "wallet":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="Wallet">
          <rect x="3" y="6" width="18" height="13" rx="3" stroke={col} strokeWidth={sw} />
          <path d="M3 10h18" stroke={col} strokeWidth={sw} />
          <circle cx="16.5" cy="14.5" r="1.3" fill={col} />
        </svg>
      );
    case "clock":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          role="img"
          aria-label="Activity"
        >
          <circle cx="12" cy="12" r="8.5" stroke={col} strokeWidth={sw} />
          <path
            d="M12 7.5V12l3 2"
            stroke={col}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "gear":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          role="img"
          aria-label="Settings"
        >
          <circle cx="12" cy="12" r="3" stroke={col} strokeWidth={sw} />
          <path
            d="M12 2.5v2.5M12 19v2.5M4.5 4.5l1.8 1.8M17.7 17.7l1.8 1.8M2.5 12H5M19 12h2.5M4.5 19.5l1.8-1.8M17.7 6.3l1.8-1.8"
            stroke={col}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </svg>
      );
    case "people":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="People">
          <circle cx="9" cy="8.5" r="3" stroke={col} strokeWidth={sw} />
          <path
            d="M3.5 18.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8"
            stroke={col}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <path
            d="M15.5 6.2a3 3 0 010 5.2M17 14c2.2.5 3.9 2 3.9 4.5"
            stroke={col}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </svg>
      );
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
