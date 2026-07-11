import { EMOJI_CHOICES, PALETTES, paletteFor } from "@keychain/core";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { CheckIcon } from "../icons.tsx";

type Step = "form" | "gen" | "done";

export const CreateSheet = ({
  onFinish,
  onToast,
}: {
  onFinish: (input: { name: string; avatar: string; color: number }) => void;
  onToast: (msg: string) => void;
}): ReactElement => {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [color, setColor] = useState(0);
  const genTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(genTimer.current), []);

  const pal = paletteFor(color);
  const canCreate = name.trim().length > 0;
  const start = (): void => {
    if (!canCreate) {
      onToast("Give your card a name");
      return;
    }
    setStep("gen");
    genTimer.current = setTimeout(() => setStep("done"), 2100);
  };

  return (
    <div style={{ animation: "riseIn .4s ease" }}>
      {step === "form" && (
        <>
          <div style={{ textAlign: "center" }}>
            <div className="sheet-title">Create a card</div>
            <div className="sheet-lead">A separate identity for a part of your life.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 30,
                background: pal.grad,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                boxShadow: `0 12px 28px -12px ${pal.shadow}`,
                transition: "background .3s",
              }}
            >
              {avatar}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginTop: 18,
              flexWrap: "wrap",
            }}
          >
            {EMOJI_CHOICES.map((emoji) => (
              <div
                key={emoji}
                role="button"
                onClick={() => setAvatar(emoji)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  cursor: "pointer",
                  transition: "transform .15s",
                  background: avatar === emoji ? "#1B1917" : "#F2EBE0",
                  transform: `scale(${avatar === emoji ? 1.05 : 1})`,
                }}
              >
                {emoji}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 9, marginTop: 16 }}>
            {PALETTES.map((p, i) => (
              <div
                key={p.grad}
                role="button"
                onClick={() => setColor(i)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: p.grad,
                  cursor: "pointer",
                  transition: "transform .15s",
                  boxShadow:
                    color === i
                      ? "0 0 0 3px #F4EFE8,0 0 0 5px #1B1917"
                      : "0 2px 6px -2px rgba(0,0,0,.3)",
                  transform: `scale(${color === i ? 1.1 : 1})`,
                }}
              />
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
              Name this card
            </div>
            <input
              className="input"
              value={name}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. Everyday, Work, Gaming"
            />
          </div>
          <div
            role="button"
            className="btn-dark press"
            onClick={start}
            style={{ marginTop: 22, opacity: canCreate ? 1 : 0.4, ["--press" as string]: 0.97 }}
          >
            Create card
          </div>
        </>
      )}
      {step === "gen" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "30px 0 20px",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 110,
              height: 110,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "3px solid #F0E9DE",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "3px solid transparent",
                borderTopColor: "#E8502A",
                animation: "spinAround 1s linear infinite",
              }}
            />
            <div style={{ fontSize: 44, animation: "floatY 1.6s ease-in-out infinite" }}>
              {avatar}
            </div>
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 24 }}>Setting things up…</div>
          <div className="sheet-lead" style={{ maxWidth: 250 }}>
            Creating your secure card and safely storing your backup.
          </div>
        </div>
      )}
      {step === "done" && (
        <div className="done-pop">
          <div className="check-bubble">
            <CheckIcon size={44} width={3} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 20 }}>You're all set!</div>
          <div className="sheet-lead" style={{ maxWidth: 260 }}>
            {name} is ready to use. We've kept a safe backup for you.
          </div>
          <div
            role="button"
            className="btn-dark press"
            onClick={() => onFinish({ name, avatar, color })}
            style={{ marginTop: 24, ["--press" as string]: 0.97 }}
          >
            Done
          </div>
        </div>
      )}
    </div>
  );
};
