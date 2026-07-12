import { type Card, type Contact, paletteFor } from "@keychain/core";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { QrCode } from "../components/QrCode.tsx";
import { copyText, shareProfile } from "../sharing.ts";

export const ShareSheet = ({
  subject,
  shareUrl,
  onToast,
}: {
  subject: Card | Contact;
  shareUrl: string;
  onToast: (msg: string) => void;
}): ReactElement => {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pal = paletteFor(subject.color);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copy = async (): Promise<void> => {
    const result = await copyText(shareUrl);
    if (!result.ok) {
      onToast("Clipboard access isn't available");
      return;
    }
    setCopied(true);
    onToast("Profile link copied");
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const share = async (): Promise<void> => {
    const result = await shareProfile({
      title: `${subject.name} profile`,
      text: `Add ${subject.name}'s profile`,
      url: shareUrl,
    });
    if (!result.ok) {
      if (result.reason !== "cancelled") onToast("Sharing isn't available right now");
      return;
    }
    onToast(result.method === "clipboard" ? "Profile link copied" : "Profile shared");
  };

  return (
    <div
      data-testid="share-sheet"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        animation: "riseIn .4s ease",
      }}
    >
      <div className="sheet-title">Share {subject.name}</div>
      <div className="sheet-lead" style={{ maxWidth: 280 }}>
        A friend can scan this code or open your link to add the profile.
      </div>
      <div
        style={{
          marginTop: 22,
          padding: 12,
          background: "#fff",
          borderRadius: 26,
          boxShadow: "0 12px 30px -14px rgba(80,50,20,.4)",
          position: "relative",
        }}
      >
        <div
          aria-hidden="true"
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
        <div data-testid="share-qr-container" style={{ overflow: "hidden", borderRadius: 18 }}>
          <QrCode value={shareUrl} />
        </div>
      </div>
      <div
        data-theme-text="primary"
        style={{ marginTop: 16, fontSize: 14, fontWeight: 800, color: "var(--kc-text)" }}
      >
        @{subject.handle.replace(/^@/u, "")}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18, width: "100%" }}>
        <button
          type="button"
          data-testid="share-copy-link"
          className="press"
          onClick={() => void copy()}
          style={{
            flex: 1,
            border: 0,
            background: "var(--kc-surface-raised)",
            borderRadius: 16,
            padding: 15,
            fontSize: 14,
            fontWeight: 800,
            color: "var(--kc-text)",
            ["--press" as string]: 0.96,
          }}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <button
          type="button"
          data-testid="share-native"
          className="press"
          onClick={() => void share()}
          style={{
            flex: 1,
            border: 0,
            background: "#1B1917",
            color: "#fff",
            borderRadius: 16,
            padding: 15,
            fontSize: 14,
            fontWeight: 800,
            ["--press" as string]: 0.96,
          }}
        >
          Share
        </button>
      </div>
    </div>
  );
};
