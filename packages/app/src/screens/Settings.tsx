import { type Card, paletteFor } from "@keychain/core";
import { type ReactElement, useState } from "react";
import { ChevronIcon } from "../icons.tsx";

const Toggle = ({ on, onFlip }: { on: boolean; onFlip: () => void }): ReactElement => (
  <div
    role="switch"
    aria-checked={on}
    onClick={onFlip}
    style={{
      width: 46,
      height: 28,
      borderRadius: 16,
      background: on ? "#28B463" : "#DAD0C1",
      position: "relative",
      transition: "background .25s",
      cursor: "pointer",
      flex: "0 0 auto",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 3,
        left: on ? 21 : 3,
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 2px 5px rgba(0,0,0,.2)",
        transition: "left .25s",
      }}
    />
  </div>
);

interface SettingsProps {
  active: Card;
  onOpenActiveCard: () => void;
  onBackup: () => void;
  onToast: (msg: string) => void;
}

export const Settings = ({
  active,
  onOpenActiveCard,
  onBackup,
  onToast,
}: SettingsProps): ReactElement => {
  const [faceId, setFaceId] = useState(true);
  const [icloud, setIcloud] = useState(true);
  const [notif, setNotif] = useState(true);
  const pal = paletteFor(active.color);

  interface RowDef {
    icon: string;
    bg: string;
    label: string;
    right: ReactElement;
    onTap?: () => void;
  }
  const chevron = (value: string): ReactElement => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#B6A78E" }}>{value}</span>
      <ChevronIcon />
    </div>
  );
  const groups: readonly { title: string; rows: readonly RowDef[] }[] = [
    {
      title: "Security",
      rows: [
        {
          icon: "🙂",
          bg: "#EAF0FF",
          label: "Face ID to approve",
          right: <Toggle on={faceId} onFlip={() => setFaceId((v) => !v)} />,
        },
        {
          icon: "🛡️",
          bg: "#E9F7EC",
          label: "Back up all cards",
          right: chevron(""),
          onTap: onBackup,
        },
      ],
    },
    {
      title: "iCloud",
      rows: [
        {
          icon: "☁️",
          bg: "#E8F0FF",
          label: "Sync with iCloud",
          right: <Toggle on={icloud} onFlip={() => setIcloud((v) => !v)} />,
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
          right: <Toggle on={notif} onFlip={() => setNotif((v) => !v)} />,
        },
        {
          icon: "🎨",
          bg: "#FCEDE7",
          label: "Appearance",
          right: chevron("Light"),
          onTap: () => onToast("Coming soon"),
        },
        {
          icon: "❓",
          bg: "#EFEAF7",
          label: "Help & support",
          right: chevron(""),
          onTap: () => onToast("Help center"),
        },
      ],
    },
  ];

  return (
    <div className="scr screen">
      <div style={{ padding: "8px 24px 18px" }}>
        <div className="hdr-title" style={{ marginTop: 0 }}>
          Settings
        </div>
      </div>
      <div style={{ padding: "0 24px 20px" }}>
        <div
          role="button"
          className="press"
          onClick={onOpenActiveCard}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "#FFF",
            borderRadius: 20,
            padding: 16,
            boxShadow: "0 4px 14px -8px rgba(80,50,20,.2)",
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
            <div style={{ fontSize: 13, fontWeight: 600, color: "#A08E78", marginTop: 1 }}>
              Active card · Tap to manage
            </div>
          </div>
          <ChevronIcon size={20} />
        </div>
      </div>
      {groups.map((group) => (
        <div key={group.title} style={{ padding: "0 24px 20px" }}>
          <div className="sec-label">{group.title}</div>
          <div className="panel">
            {group.rows.map((row) => (
              <div
                key={row.label}
                role="button"
                className="row"
                onClick={row.onTap}
                style={{ cursor: "pointer" }}
              >
                <div
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
                </div>
                <div style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: "#241F1B" }}>
                  {row.label}
                </div>
                {row.right}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div
        style={{
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "#BCAE97",
          padding: "4px 24px 10px",
        }}
      >
        Keychain · Version 1.0
      </div>
    </div>
  );
};
