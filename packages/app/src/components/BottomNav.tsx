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
  <div data-testid="bottom-navigation" className="bottom-nav">
    <div data-testid="bottom-navigation-inner" className="bottom-nav-inner">
      {ITEMS.map((item) => {
        const on = current === item.key;
        return (
          <button
            type="button"
            key={item.key}
            data-testid={`nav-${item.key}`}
            aria-current={on ? "page" : undefined}
            className="bottom-nav-item press"
            onClick={() => onGo(item.key)}
            style={{ ["--press" as string]: 0.88 }}
          >
            <div data-testid={`nav-${item.key}-icon`} className="bottom-nav-icon">
              <NavIcon kind={item.icon} active={on} />
            </div>
            <div data-testid={`nav-${item.key}-label`} className="bottom-nav-label">
              {item.label}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);
