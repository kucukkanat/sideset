import type { ReactElement } from "react";
import { NavIcon, type NavIconKind } from "../icons.tsx";

export type NavKey = "home" | "contacts" | "activity" | "settings";

const ITEMS: readonly { key: NavKey; label: string; icon: NavIconKind }[] = [
  { key: "home", label: "Wallet", icon: "wallet" },
  { key: "contacts", label: "People", icon: "people" },
  { key: "activity", label: "Activity", icon: "clock" },
  { key: "settings", label: "Settings", icon: "gear" },
];

export const BottomNav = ({
  current,
  onGo,
}: {
  current: NavKey;
  onGo: (key: NavKey) => void;
}): ReactElement => (
  <div
    style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 55,
      padding: "8px 16px 26px",
      background: "linear-gradient(to top,#F4EFE8 60%,rgba(244,239,232,0))",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(20px)",
        borderRadius: 26,
        padding: "8px 6px",
        boxShadow: "0 10px 30px -10px rgba(80,50,20,.35),0 0 0 1px rgba(255,255,255,.6) inset",
      }}
    >
      {ITEMS.map((item) => {
        const on = current === item.key;
        return (
          <div
            key={item.key}
            role="button"
            className="press"
            onClick={() => onGo(item.key)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 0",
              color: on ? "#E8502A" : "#B3A691",
              ["--press" as string]: 0.88,
            }}
          >
            <div style={{ height: 24, display: "flex", alignItems: "center" }}>
              <NavIcon kind={item.icon} active={on} />
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1 }}>{item.label}</div>
          </div>
        );
      })}
    </div>
  </div>
);
