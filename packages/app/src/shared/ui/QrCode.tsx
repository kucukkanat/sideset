import encodeQr from "qr";
import { type ReactElement, useMemo } from "react";

export const QrCode = ({ value, size = 210 }: { value: string; size?: number }): ReactElement => {
  const code = useMemo(() => {
    try {
      const cells = encodeQr(value, "raw", { border: 4, ecc: "low" });
      return {
        edge: cells.length,
        path: cells
          .flatMap((row, y) => row.map((enabled, x) => (enabled ? `M${x} ${y}h1v1h-1z` : "")))
          .join(""),
      };
    } catch {
      return null;
    }
  }, [value]);

  if (code === null) {
    return (
      <div
        data-testid="profile-qr-fallback"
        data-theme-text="muted"
        role="note"
        style={{
          width: size,
          minHeight: size,
          display: "grid",
          placeItems: "center",
          padding: 24,
          color: "var(--kc-muted)",
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.5,
        }}
      >
        This profile is too large for a code. Use the link buttons instead.
      </div>
    );
  }

  return (
    <svg
      data-testid="profile-qr"
      role="img"
      aria-label="Scannable profile code"
      viewBox={`0 0 ${code.edge} ${code.edge}`}
      width={size}
      height={size}
      style={{ display: "block", background: "#fff" }}
      shapeRendering="crispEdges"
    >
      <rect width={code.edge} height={code.edge} fill="#fff" />
      <path d={code.path} fill="#1B1917" />
    </svg>
  );
};
