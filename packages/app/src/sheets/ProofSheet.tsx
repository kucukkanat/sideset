import {
  type Card,
  PROOF_ORDER,
  PROVIDER_META,
  type ProviderId,
  proofUserFor,
} from "@keychain/core";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { CheckIcon, ProviderIcon } from "../icons.tsx";

type Step = "pick" | "proving" | "done";

/** Keybase-style flow: pick a provider, post a signed proof, confirm. */
export const ProofSheet = ({
  card,
  onFinish,
}: {
  card: Card;
  onFinish: (provider: ProviderId) => void;
}): ReactElement => {
  const [step, setStep] = useState<Step>("pick");
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const prove = (p: ProviderId): void => {
    setProvider(p);
    setStep("proving");
    timer.current = setTimeout(() => setStep("done"), 1900);
  };
  const username = provider ? proofUserFor(card, provider) : "";
  const meta = provider ? PROVIDER_META[provider] : null;

  return (
    <div style={{ animation: "riseIn .4s ease" }}>
      {step === "pick" && (
        <>
          <div style={{ textAlign: "center" }}>
            <div className="sheet-title">Add a proof</div>
            <div
              className="sheet-lead"
              style={{ maxWidth: 290, marginLeft: "auto", marginRight: "auto" }}
            >
              Publicly link an account to <b style={{ color: "#3A322A" }}>{card.name}</b>. Keychain
              posts a small signed proof and checks it — so others know it's really you.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
            {PROOF_ORDER.map((p) => (
              <div
                key={p}
                role="button"
                className="press"
                onClick={() => prove(p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#fff",
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: "0 3px 10px -5px rgba(80,50,20,.18)",
                  ["--press" as string]: 0.95,
                }}
              >
                <div className="row-icon" style={{ background: PROVIDER_META[p].bg }}>
                  <ProviderIcon provider={p} size={26} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#241F1B" }}>
                  {PROVIDER_META[p].name}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {step === "proving" && provider && meta && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "26px 0",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 104,
              height: 104,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{ position: "absolute", inset: 0, borderRadius: 30, background: meta.bg }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 30,
                border: "2px solid #E8502A",
                animation: "pulseRing 1.3s ease-out infinite",
              }}
            />
            <div style={{ position: "relative", display: "flex" }}>
              <ProviderIcon provider={provider} size={32} />
            </div>
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 24 }}>
            {provider === "email"
              ? "Sending a verification email…"
              : `Posting your proof to ${meta.name}…`}
          </div>
          <div className="sheet-lead" style={{ maxWidth: 260 }}>
            Checking that <b style={{ color: "#3A322A" }}>{username}</b> is really yours.
          </div>
        </div>
      )}
      {step === "done" && provider && meta && (
        <div className="done-pop">
          <div style={{ position: "relative", width: 88, height: 88 }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 26,
                background: meta.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "checkPop .5s cubic-bezier(.2,1.3,.5,1)",
              }}
            >
              <ProviderIcon provider={provider} size={32} />
            </div>
            <div
              style={{
                position: "absolute",
                right: -6,
                bottom: -6,
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#28B463",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 4px #F7F2EA",
              }}
            >
              <CheckIcon size={18} stroke="#fff" width={3} />
            </div>
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 20 }}>Proof verified</div>
          <div className="sheet-lead" style={{ maxWidth: 270, lineHeight: 1.5 }}>
            You're now provably <b style={{ color: "#3A322A" }}>{username}</b> on {meta.name}. It
            shows on your {card.name} card.
          </div>
          <div
            role="button"
            className="btn-dark press"
            onClick={() => onFinish(provider)}
            style={{ marginTop: 24, ["--press" as string]: 0.97 }}
          >
            Done
          </div>
        </div>
      )}
    </div>
  );
};
