import type { ReactElement } from "react";
import { NavIcon, type NavIconKind } from "../icons.tsx";

export type NavKey = "home" | "contacts" | "tools" | "settings";

const ITEMS: readonly { key: NavKey; label: string; icon: NavIconKind }[] = [
  { key: "home", label: "Wallet", icon: "wallet" },
  { key: "contacts", label: "People", icon: "people" },
  { key: "tools", label: "Tools", icon: "tools" },
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
    data-testid="bottom-navigation"
    className="bottom-nav"
    style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 55,
      padding: "8px 16px calc(26px + env(safe-area-inset-bottom))",
      background: "linear-gradient(to top,#F4EFE8 60%,rgba(244,239,232,0))",
    }}
  >
    <div
      data-testid="bottom-navigation-inner"
      className="bottom-nav-inner"
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
          <button
            type="button"
            key={item.key}
            data-testid={`nav-${item.key}`}
            aria-current={on ? "page" : undefined}
            className="press"
            onClick={() => onGo(item.key)}
            style={{
              border: 0,
              background: "transparent",
              fontFamily: "inherit",
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
            <div
              data-testid={`nav-${item.key}-icon`}
              style={{ height: 24, display: "flex", alignItems: "center" }}
            >
              <NavIcon kind={item.icon} active={on} />
            </div>
            <div
              data-testid={`nav-${item.key}-label`}
              style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1 }}
            >
              {item.label}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);
