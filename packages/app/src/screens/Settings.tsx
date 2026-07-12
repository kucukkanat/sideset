import { type Card, paletteFor } from "@keychain/core";
import type { ReactElement } from "react";
import { ComingSoon } from "../components/ComingSoon.tsx";
import { ChevronIcon } from "../icons.tsx";

export type ThemePreference = "light" | "dark" | "system";

interface SettingsProps {
  active: Card;
  theme: ThemePreference;
  onOpenActiveCard: () => void;
  onAppearance: () => void;
  onBackup: () => void;
  onRestore: () => void;
  onHelp: () => void;
}

interface RowBase {
  readonly icon: string;
  readonly bg: string;
  readonly label: string;
}

type RowDef = RowBase &
  (
    | { readonly disabled: true }
    | { readonly disabled?: false; readonly detail?: string; readonly onTap: () => void }
  );

const themeLabel = (theme: ThemePreference): string => {
  switch (theme) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    case "system":
      return "System";
  }
};

export const Settings = ({
  active,
  theme,
  onOpenActiveCard,
  onAppearance,
  onBackup,
  onRestore,
  onHelp,
}: SettingsProps): ReactElement => {
  const pal = paletteFor(active.color);
  const groups: readonly { readonly title: string; readonly rows: readonly RowDef[] }[] = [
    {
      title: "Security",
      rows: [
        {
          icon: "🙂",
          bg: "#EAF0FF",
          label: "Approve with Face ID",
          disabled: true,
        },
        {
          icon: "🛡️",
          bg: "#E9F7EC",
          label: "Export a backup",
          detail: "This device",
          onTap: onBackup,
        },
        {
          icon: "📥",
          bg: "#FFF6DB",
          label: "Restore a backup",
          onTap: onRestore,
        },
      ],
    },
    {
      title: "Cloud",
      rows: [
        {
          icon: "☁️",
          bg: "#E8F0FF",
          label: "Sync with iCloud",
          disabled: true,
        },
      ],
    },
    {
      title: "Preferences",
      rows: [
        {
          icon: "🔔",
          bg: "#FFF6DB",
          label: "Notifications",
          disabled: true,
        },
        {
          icon: "🎨",
          bg: "#FCEDE7",
          label: "Appearance",
          detail: themeLabel(theme),
          onTap: onAppearance,
        },
        {
          icon: "❓",
          bg: "#EFEAF7",
          label: "Help & support",
          onTap: onHelp,
        },
      ],
    },
  ];

  return (
    <div data-testid="screen-settings" className="scr screen">
      <div style={{ padding: "8px 24px 18px" }}>
        <div className="hdr-title" style={{ marginTop: 0 }}>
          Settings
        </div>
      </div>
      <div style={{ padding: "0 24px 20px" }}>
        <button
          data-testid="settings-active-card"
          data-theme-surface="card"
          type="button"
          className="press"
          onClick={onOpenActiveCard}
          style={{
            width: "100%",
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "var(--kc-surface)",
            borderRadius: 20,
            padding: 16,
            boxShadow: "0 4px 14px -8px rgba(80,50,20,.2)",
            textAlign: "left",
            ["--press" as string]: 0.98,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: pal.grad,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: `0 6px 14px -6px ${pal.shadow}`,
            }}
          >
            {active.avatar}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{active.name}</div>
            <div
              data-theme-text="muted"
              style={{ fontSize: 13, fontWeight: 600, color: "var(--kc-subtle)", marginTop: 1 }}
            >
              Active card · Tap to manage
            </div>
          </div>
          <ChevronIcon size={20} />
        </button>
      </div>
      {groups.map((group) => (
        <div
          data-testid={`settings-group-${group.title.toLowerCase()}`}
          key={group.title}
          style={{ padding: "0 24px 20px" }}
        >
          <div
            data-testid={`settings-group-${group.title.toLowerCase()}-label`}
            className="sec-label"
          >
            {group.title}
          </div>
          <div data-testid={`settings-group-${group.title.toLowerCase()}-list`} className="panel">
            {group.rows.map((row) => {
              const disabled = row.disabled === true;
              return (
                <button
                  type="button"
                  key={row.label}
                  data-testid={`settings-${row.label.toLowerCase().replaceAll(" ", "-")}`}
                  className={disabled ? "row" : "row press"}
                  disabled={disabled}
                  aria-disabled={disabled}
                  onClick={disabled ? undefined : row.onTap}
                  style={{
                    width: "100%",
                    borderRight: "none",
                    borderBottom: "none",
                    borderLeft: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.55 : 1,
                    ["--press" as string]: 0.99,
                  }}
                >
                  <span
                    className="row-icon"
                    style={{
                      background: row.bg,
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      fontSize: 17,
                    }}
                  >
                    {row.icon}
                  </span>
                  <span
                    data-theme-text="primary"
                    style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: "var(--kc-text)" }}
                  >
                    {row.label}
                  </span>
                  {disabled ? (
                    <ComingSoon />
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {row.detail && (
                        <span
                          data-theme-text="faint"
                          style={{ fontSize: 13, fontWeight: 600, color: "var(--kc-faint)" }}
                        >
                          {row.detail}
                        </span>
                      )}
                      <ChevronIcon />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--kc-faint)",
          padding: "4px 24px 10px",
        }}
      >
        Keychain · Version 1.0
      </div>
    </div>
  );
};
