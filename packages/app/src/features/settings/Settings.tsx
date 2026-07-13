import { CardAvatar } from "@features/cards/CardAvatar.tsx";
import { type Card, paletteFor } from "@keychain/core";
import { ChevronIcon } from "@shared/ui/icons.tsx";
import { ScreenHeader } from "@shared/ui/ScreenHeader.tsx";
import {
  CircleHelp,
  Download,
  LayoutGrid,
  type LucideIcon,
  Palette,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { ReactElement } from "react";

export type ThemePreference = "light" | "dark" | "system";

interface SettingsProps {
  active: Card;
  theme: ThemePreference;
  onOpenActiveCard: () => void;
  onFeatures: () => void;
  onAppearance: () => void;
  onBackup: () => void;
  onRestore: () => void;
  onHelp: () => void;
  onReset: () => void;
}

interface RowBase {
  readonly icon: LucideIcon;
  readonly bg: string;
  readonly fg: string;
  readonly label: string;
}

type RowDef = RowBase & { readonly detail?: string; readonly onTap: () => void };

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
  onFeatures,
  onAppearance,
  onBackup,
  onRestore,
  onHelp,
  onReset,
}: SettingsProps): ReactElement => {
  const pal = paletteFor(active.color);
  const groups: readonly { readonly title: string; readonly rows: readonly RowDef[] }[] = [
    {
      title: "Security",
      rows: [
        {
          icon: ShieldCheck,
          bg: "#E9F7EC",
          fg: "#18713B",
          label: "Export a backup",
          detail: "This device",
          onTap: onBackup,
        },
        {
          icon: Download,
          bg: "#FFF6DB",
          fg: "#805400",
          label: "Restore a backup",
          onTap: onRestore,
        },
      ],
    },
    {
      title: "Preferences",
      rows: [
        {
          icon: LayoutGrid,
          bg: "#E8F0FF",
          fg: "#244BB5",
          label: "Features",
          onTap: onFeatures,
        },
        {
          icon: Palette,
          bg: "#FCEDE7",
          fg: "#A33A21",
          label: "Appearance",
          detail: themeLabel(theme),
          onTap: onAppearance,
        },
        {
          icon: CircleHelp,
          bg: "#EFEAF7",
          fg: "#67409B",
          label: "Help & support",
          onTap: onHelp,
        },
      ],
    },
    {
      title: "Application",
      rows: [
        {
          icon: Trash2,
          bg: "#FDECE7",
          fg: "#AE321F",
          label: "Reset application",
          detail: "Erase local data",
          onTap: onReset,
        },
      ],
    },
  ];

  return (
    <div data-testid="screen-settings" className="scr screen">
      <ScreenHeader title="Settings" subtitle="Privacy, backups, and preferences" />
      <div className="app-page-content">
        <button
          data-testid="settings-active-card"
          data-theme-surface="card"
          type="button"
          className="settings-card press"
          onClick={onOpenActiveCard}
          style={{
            ["--press" as string]: 0.98,
          }}
        >
          <div
            className="settings-card-avatar"
            style={{
              background: pal.grad,
              boxShadow: `0 6px 14px -6px ${pal.shadow}`,
            }}
          >
            <CardAvatar card={active} style={{ width: 48, height: 48 }} />
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
          className="app-page-content"
        >
          <div
            data-testid={`settings-group-${group.title.toLowerCase()}-label`}
            className="sec-label"
          >
            {group.title}
          </div>
          <div data-testid={`settings-group-${group.title.toLowerCase()}-list`} className="panel">
            {group.rows.map((row) => {
              const Icon = row.icon;
              return (
                <button
                  type="button"
                  key={row.label}
                  data-testid={`settings-${row.label.toLowerCase().replaceAll(" ", "-")}`}
                  className="row press"
                  onClick={row.onTap}
                  style={{
                    width: "100%",
                    borderRight: "none",
                    borderBottom: "none",
                    borderLeft: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    ["--press" as string]: 0.99,
                  }}
                >
                  <span
                    className="row-icon"
                    style={{
                      background: row.bg,
                      color: row.fg,
                    }}
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={2.1} />
                  </span>
                  <span
                    data-theme-text="primary"
                    style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: "var(--kc-text)" }}
                  >
                    {row.label}
                  </span>
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
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div
        className="app-page-footer"
        style={{
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--kc-faint)",
        }}
      >
        Keychain · Version 1.0
      </div>
    </div>
  );
};
