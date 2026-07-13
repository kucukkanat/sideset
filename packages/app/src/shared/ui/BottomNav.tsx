import { NavIcon, type NavIconKind } from "@shared/ui/icons.tsx";
import type { MouseEvent, ReactElement } from "react";

export interface BottomNavItem<Key extends string> {
  readonly key: Key;
  readonly label: string;
  readonly icon: NavIconKind;
  readonly href: `#/${string}`;
}

export const BottomNav = <Key extends string>({
  items,
  current,
  onGo,
}: {
  readonly items: readonly BottomNavItem<Key>[];
  readonly current: Key | null;
  readonly onGo: (key: Key) => void;
}): ReactElement => (
  <nav data-testid="bottom-navigation" className="bottom-nav" aria-label="Primary">
    <div data-testid="bottom-navigation-inner" className="bottom-nav-inner">
      {items.map((item) => {
        const on = current === item.key;
        return (
          <a
            key={item.key}
            href={item.href}
            data-testid={`nav-${item.key}`}
            aria-current={on ? "page" : undefined}
            className="bottom-nav-item press"
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              onGo(item.key);
            }}
            style={{ ["--press" as string]: 0.88 }}
          >
            <div data-testid={`nav-${item.key}-icon`} className="bottom-nav-icon">
              <NavIcon kind={item.icon} active={on} />
            </div>
            <div data-testid={`nav-${item.key}-label`} className="bottom-nav-label">
              {item.label}
            </div>
          </a>
        );
      })}
    </div>
  </nav>
);
