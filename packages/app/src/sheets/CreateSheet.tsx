import { type IdentityKeyPair, PALETTES, paletteFor } from "@keychain/core";
import { Eye, EyeOff, KeyRound, RefreshCw, Upload } from "lucide-react";
import { type FormEvent, type ReactElement, useEffect, useRef, useState } from "react";
import { generateIdentityKeyPair, identityFromPrivateKey } from "../accountVerification.ts";
import { readAvatarFile } from "../avatar.ts";
import { CardAvatar } from "../components/CardAvatar.tsx";
import { CheckIcon } from "../icons.tsx";

type Step = "form" | "gen" | "done";

export const CreateSheet = ({
  onFinish,
  onDone,
  onToast,
}: {
  onFinish: (input: {
    name: string;
    username: string;
    email: string;
    avatar: string;
    color: number;
    identity: IdentityKeyPair;
  }) => boolean;
  onDone: () => void;
  onToast: (msg: string) => void;
}): ReactElement => {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [identity, setIdentity] = useState<IdentityKeyPair | null>(null);
  const [color, setColor] = useState(0);
  const [isGeneratingIdentity, setIsGeneratingIdentity] = useState(true);
  const [isImportingIdentity, setIsImportingIdentity] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const genTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void generateIdentityKeyPair().then((generated) => {
      if (active) {
        setIdentity(generated);
        setIsGeneratingIdentity(false);
      }
    });
    return () => {
      active = false;
      clearTimeout(genTimer.current);
    };
  }, []);

  const pal = paletteFor(color);
  const importedIdentity = isImportingIdentity ? identityFromPrivateKey(privateKey) : null;
  const canCreate = name.trim().length > 0 && identity !== null;
  const regenerateAvatar = async (): Promise<void> => {
    setIsGeneratingIdentity(true);
    setIdentity(null);
    setAvatar("");
    try {
      setIdentity(await generateIdentityKeyPair());
    } catch {
      onToast("Couldn't generate a new avatar");
    } finally {
      setIsGeneratingIdentity(false);
    }
  };
  const uploadAvatar = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    const result = await readAvatarFile(file);
    if (result.ok) setAvatar(result.avatar);
    else onToast(result.message);
  };
  const start = (): void => {
    if (!canCreate) {
      onToast("Give your card a name");
      return;
    }
    setStep("gen");
    genTimer.current = setTimeout(() => {
      if (identity !== null && onFinish({ name, username, email, avatar, color, identity }))
        setStep("done");
      else setStep("form");
    }, 600);
  };
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    start();
  };
  const useGeneratedIdentity = (): void => {
    setIsImportingIdentity(false);
    setPrivateKey("");
    void regenerateAvatar();
  };
  const useImportedIdentity = (): void => {
    setIsImportingIdentity(true);
    setIdentity(null);
  };
  return (
    <form
      data-testid="create-card-sheet"
      onSubmit={submit}
      style={{ animation: "riseIn .4s ease" }}
    >
      {step === "form" && (
        <>
          <div style={{ textAlign: "center" }}>
            <div className="sheet-title">Create a card</div>
            <div className="sheet-lead">A separate profile for a part of your life.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
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
              {identity === null ? (
                "…"
              ) : (
                <CardAvatar
                  card={{ id: "new", avatar, identity }}
                  style={{ width: 86, height: 86 }}
                />
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              data-testid="create-card-avatar-random"
              aria-label="Generate a new random avatar and keypair"
              disabled={isGeneratingIdentity}
              onClick={() => void regenerateAvatar()}
              style={{
                width: 44,
                height: 44,
                border: 0,
                borderRadius: 14,
                cursor: "pointer",
              }}
            >
              <RefreshCw aria-hidden="true" size={20} />
            </button>
            <label
              aria-label="Upload an avatar image"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--kc-text)",
                background: "var(--kc-surface-raised)",
              }}
            >
              <Upload aria-hidden="true" size={20} />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                data-testid="create-card-avatar-upload"
                aria-label="Upload an avatar image"
                onChange={(event) => void uploadAvatar(event.currentTarget.files?.[0])}
                style={{ display: "none" }}
              />
            </label>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 16,
            }}
          >
            {PALETTES.map((p, i) => (
              <div
                key={p.grad}
                data-testid={`create-card-color-${i}`}
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
              data-testid="create-card-name"
              className="input"
              maxLength={50}
              required
              value={name}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. Everyday, Work, Gaming"
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
              Username
            </div>
            <input
              data-testid="create-card-username"
              className="input"
              maxLength={80}
              value={username}
              onInput={(event) => setUsername(event.currentTarget.value)}
              placeholder="e.g. finnriver"
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
              Email
            </div>
            <input
              data-testid="create-card-email"
              className="input"
              type="email"
              maxLength={254}
              value={email}
              onInput={(event) => setEmail(event.currentTarget.value)}
              placeholder="you@example.com"
            />
          </div>
          <div style={{ marginTop: 16 }}>
            {!isImportingIdentity ? (
              <button
                type="button"
                data-testid="create-card-import-identity"
                onClick={useImportedIdentity}
                style={{
                  width: "100%",
                  border: "1px solid rgba(27,25,23,.14)",
                  borderRadius: 14,
                  padding: "12px 14px",
                  background: "transparent",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <KeyRound aria-hidden="true" size={18} />
                Use your Nostr private key
              </button>
            ) : (
              <div
                data-testid="create-card-identity-import"
                style={{ padding: 16, borderRadius: 16, background: "rgba(232,80,42,.07)" }}
              >
                <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
                  Nostr private key
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    data-testid="create-card-private-key"
                    className="input"
                    type={showPrivateKey ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    value={privateKey}
                    onInput={(event) => {
                      const value = event.currentTarget.value;
                      setPrivateKey(value);
                      setIdentity(identityFromPrivateKey(value));
                    }}
                    placeholder="nsec1…"
                    aria-invalid={privateKey.length > 0 && importedIdentity === null}
                    style={{ paddingRight: 48, fontFamily: "monospace" }}
                  />
                  <button
                    type="button"
                    data-testid="create-card-private-key-visibility"
                    aria-label={showPrivateKey ? "Hide private key" : "Show private key"}
                    onClick={() => setShowPrivateKey((shown) => !shown)}
                    style={{
                      position: "absolute",
                      right: 4,
                      top: 4,
                      width: 40,
                      height: 40,
                      border: 0,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    {showPrivateKey ? (
                      <EyeOff aria-hidden="true" size={19} />
                    ) : (
                      <Eye aria-hidden="true" size={19} />
                    )}
                  </button>
                </div>
                {privateKey.length > 0 && importedIdentity === null && (
                  <div
                    data-testid="create-card-private-key-error"
                    style={{ color: "#B43820", fontSize: 13, marginTop: 7 }}
                  >
                    Enter a valid nsec private key.
                  </div>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.4, marginTop: 8, opacity: 0.72 }}>
                  Your key stays on this device and will be included in wallet backups. Anyone with
                  it can use your identity.
                </div>
                <button
                  type="button"
                  data-testid="create-card-use-generated-identity"
                  onClick={useGeneratedIdentity}
                  style={{
                    border: 0,
                    padding: "10px 0 0",
                    background: "transparent",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Use a new identity instead
                </button>
              </div>
            )}
          </div>
          <button
            type="submit"
            data-testid="create-card-submit"
            className="btn-dark press"
            disabled={!canCreate}
            style={{
              marginTop: 20,
              border: 0,
              opacity: canCreate ? 1 : 0.4,
              ["--press" as string]: 0.97,
            }}
          >
            Create card
          </button>
        </>
      )}
      {step === "gen" && (
        <div
          data-testid="create-card-progress"
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
            <div
              style={{
                fontSize: 44,
                animation: "floatY 1.6s ease-in-out infinite",
              }}
            >
              {identity === null ? (
                "…"
              ) : (
                <CardAvatar
                  card={{ id: "new", avatar, identity }}
                  style={{ width: 72, height: 72 }}
                />
              )}
            </div>
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 24 }}>Setting things up…</div>
          <div className="sheet-lead" style={{ maxWidth: 250 }}>
            Creating your card and saving it on this device.
          </div>
        </div>
      )}
      {step === "done" && (
        <div data-testid="create-card-complete" className="done-pop">
          <div className="check-bubble">
            <CheckIcon size={44} width={3} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 20 }}>You're all set!</div>
          <div className="sheet-lead" style={{ maxWidth: 260 }}>
            {name} is ready to use. You can export a backup from Settings.
          </div>
          <button
            type="button"
            data-testid="create-card-done"
            className="btn-dark press"
            onClick={onDone}
            style={{ marginTop: 24, border: 0, ["--press" as string]: 0.97 }}
          >
            Done
          </button>
        </div>
      )}
    </form>
  );
};
