import type { ReactElement } from "react";

export const ComingSoon = (): ReactElement => (
  <span
    data-testid="coming-soon"
    data-theme-text="muted"
    style={{
      display: "inline-flex",
      alignItems: "center",
      flex: "0 0 auto",
      borderRadius: 999,
      background: "var(--kc-disabled-bg)",
      color: "var(--kc-disabled-text)",
      padding: "4px 8px",
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: 0.35,
      lineHeight: 1,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}
  >
    Coming soon
  </span>
);
