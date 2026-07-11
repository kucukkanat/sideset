import { type Card, friendlyId, paletteFor, QR_SIZE, qrPattern } from "@keychain/core";
import { type ReactElement, useMemo, useRef, useState } from "react";

export const ShareSheet = ({
  card,
  onToast,
  onClose,
}: {
  card: Card;
  onToast: (msg: string) => void;
  onClose: () => void;
}): ReactElement => {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pal = paletteFor(card.color);
  const id = friendlyId(card.name);
  // 441 cells — compute once per card, not per render.
  const cells = useMemo(() => qrPattern(id), [id]);

  const copy = (): void => {
    setCopied(true);
    onToast("Link copied");
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        animation: "riseIn .4s ease",
      }}
    >
      <div className="sheet-title">Share {card.name}</div>
      <div className="sheet-lead" style={{ maxWidth: 270 }}>
        Let a friend or app add you. They just scan this — no copying codes.
      </div>
      <div
        style={{
          marginTop: 22,
          padding: 18,
          background: "#fff",
          borderRadius: 26,
          boxShadow: "0 12px 30px -14px rgba(80,50,20,.4)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 26,
            padding: 2,
            background: pal.grad,
            WebkitMask: "linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${QR_SIZE},1fr)`,
            width: 210,
            height: 210,
          }}
        >
          {cells.map((on, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: cells are a fixed positional grid.
              key={i}
              style={{ background: on ? "#1B1917" : "transparent", borderRadius: 1 }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 52,
            height: 52,
            borderRadius: 15,
            background: pal.grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            boxShadow: "0 0 0 5px #fff",
          }}
        >
          {card.avatar}
        </div>
      </div>
      <div style={{ marginTop: 18, fontSize: 14, fontWeight: 700, color: "#3A322A" }}>{id}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 18, width: "100%" }}>
        <div
          role="button"
          className="press"
          onClick={copy}
          style={{
            flex: 1,
            background: "#F0E9DE",
            borderRadius: 16,
            padding: 15,
            fontSize: 14,
            fontWeight: 800,
            color: "#3A322A",
            ["--press" as string]: 0.96,
          }}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </div>
        <div
          role="button"
          className="press"
          onClick={onClose}
          style={{
            flex: 1,
            background: "#1B1917",
            color: "#fff",
            borderRadius: 16,
            padding: 15,
            fontSize: 14,
            fontWeight: 800,
            ["--press" as string]: 0.96,
          }}
        >
          Share link
        </div>
      </div>
    </div>
  );
};
