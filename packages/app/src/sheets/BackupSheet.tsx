import { type Card, passStrength, STRENGTH_COLORS, STRENGTH_LABELS } from "@keychain/core";
import { type ReactElement, useState } from "react";
import { CheckIcon, ShieldIcon } from "../icons.tsx";

export const BackupSheet = ({
  card,
  onToast,
  onDone,
}: {
  card: Card;
  onToast: (msg: string) => void;
  onDone: () => void;
}): ReactElement => {
  const [step, setStep] = useState<"intro" | "done">("intro");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const strength = passStrength(pass);
  const strengthColor = STRENGTH_COLORS[Math.min(strength - 1, 2)] ?? "#B6A78E";

  const save = (): void => {
    if (strength < 1) {
      onToast("Make it a bit stronger");
      return;
    }
    setStep("done");
  };

  return (
    <div style={{ animation: "riseIn .4s ease" }}>
      {step === "intro" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 24,
              background: "#E8F0FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 22px -10px rgba(46,107,230,.5)",
            }}
          >
            <ShieldIcon size={40} width={1.8} />
          </div>
          <div className="sheet-title" style={{ marginTop: 18 }}>
            Save your backup
          </div>
          <div className="sheet-lead" style={{ marginTop: 8, maxWidth: 290, lineHeight: 1.5 }}>
            If you ever lose your phone, this is the only way to get{" "}
            <b style={{ color: "#3A322A" }}>{card.name}</b> back. Pick a password only you know.
          </div>
          <div style={{ width: "100%", marginTop: 22, textAlign: "left" }}>
            <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
              Create a backup password
            </div>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={showPass ? "text" : "password"}
                placeholder="At least 8 characters"
                style={{ padding: "16px 52px 16px 16px" }}
                value={pass}
                onInput={(e) => setPass(e.currentTarget.value)}
              />
              <div
                role="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 19,
                  cursor: "pointer",
                  opacity: 0.55,
                }}
              >
                {showPass ? "🙈" : "👁️"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    transition: "background .25s",
                    background: i < strength ? strengthColor : "#E4DBCC",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: strength > 0 ? strengthColor : "#B6A78E",
                marginTop: 7,
              }}
            >
              {pass ? STRENGTH_LABELS[strength] : "Use letters, numbers & a symbol"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#FFF8EC",
              borderRadius: 14,
              padding: "13px 15px",
              marginTop: 18,
              width: "100%",
            }}
          >
            <span style={{ fontSize: 18 }}>💡</span>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "#8A6D3B",
                textAlign: "left",
                lineHeight: 1.4,
              }}
            >
              We can't reset this for you. Keep it somewhere safe.
            </div>
          </div>
          <div
            role="button"
            className="btn-dark press"
            onClick={save}
            style={{
              marginTop: 20,
              background: "#2E6BE6",
              opacity: strength >= 1 ? 1 : 0.45,
              ["--press" as string]: 0.97,
            }}
          >
            Save to iCloud
          </div>
        </div>
      )}
      {step === "done" && (
        <div className="done-pop">
          <div className="check-bubble">
            <CheckIcon size={44} width={3} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 20 }}>Backup saved</div>
          <div className="sheet-lead" style={{ maxWidth: 260 }}>
            {card.name} is safely backed up to your iCloud. You're protected.
          </div>
          <div
            role="button"
            className="btn-dark press"
            onClick={onDone}
            style={{ marginTop: 24, ["--press" as string]: 0.97 }}
          >
            Done
          </div>
        </div>
      )}
    </div>
  );
};
