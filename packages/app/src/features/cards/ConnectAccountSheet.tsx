import {
  createGithubVerificationCode,
  generateIdentityKeyPair,
  githubProfileSettingsUrl,
  isGithubUsername,
  verifyGithubProfile,
} from "@features/identity/accountVerification.ts";
import { copyText } from "@features/profile-sharing/sharing.ts";
import {
  type Card,
  type IdentityKeyPair,
  PROOF_ORDER,
  PROVIDER_META,
  type ProviderId,
} from "@keychain/core";
import { ComingSoon } from "@shared/ui/ComingSoon.tsx";
import { CheckIcon, CopyIcon, ProviderIcon } from "@shared/ui/icons.tsx";
import { type FormEvent, type ReactElement, useState } from "react";

type Step = "providers" | "github" | "code" | "checking" | "done";

const availableProviders: readonly ProviderId[] = ["github"];

export const ConnectAccountSheet = ({
  card,
  onVerified,
  onIdentityReady,
}: {
  card: Card;
  onVerified: (account: {
    readonly username: string;
    readonly verificationCode: string;
    readonly identity: IdentityKeyPair;
  }) => void;
  onIdentityReady: (identity: IdentityKeyPair) => void;
}): ReactElement => {
  const [step, setStep] = useState<Step>("providers");
  const [username, setUsername] = useState("");
  const [identity, setIdentity] = useState<IdentityKeyPair | null>(card.identity ?? null);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = (provider: ProviderId): void => {
    if (provider === "github") {
      setError(null);
      setStep("github");
    }
  };

  const createCode = async (): Promise<void> => {
    const normalized = username.trim();
    if (!isGithubUsername(normalized)) {
      setError("Enter a valid GitHub username");
      return;
    }
    setError(null);
    try {
      const nextIdentity = identity ?? (await generateIdentityKeyPair());
      if (identity === null) {
        setIdentity(nextIdentity);
        onIdentityReady(nextIdentity);
      }
      setVerificationCode(await createGithubVerificationCode(nextIdentity, normalized));
      setStep("code");
    } catch {
      setError("This device couldn’t create a verification code. Try again.");
    }
  };

  const checkGithub = async (): Promise<void> => {
    const normalized = username.trim();
    if (!isGithubUsername(normalized) || identity === null || verificationCode === null) {
      setError("Create a verification code first");
      return;
    }
    setError(null);
    setStep("checking");
    const result = await verifyGithubProfile(normalized, verificationCode, identity.publicKey);
    if (result.ok) {
      setUsername(result.username);
      setStep("done");
      return;
    }
    if (result.reason === "invalid-code") setVerificationCode(null);
    setStep("github");
    setError(
      result.reason === "missing-code"
        ? "We couldn’t find the code yet. Add it to your bio and try again."
        : result.reason === "not-found"
          ? "We couldn’t find that public profile. Check the username and try again."
          : result.reason === "rate-limited"
            ? "GitHub is limiting checks right now. Try again in a little while."
            : result.reason === "invalid-username"
              ? "Enter a valid GitHub username"
              : result.reason === "invalid-code"
                ? "This verification code is no longer valid. Create a new one."
                : "GitHub couldn’t be reached. Check your connection and try again.",
    );
  };

  const copyCode = async (): Promise<void> => {
    if (verificationCode !== null) await copyText(verificationCode);
  };
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (step === "github" || step === "code") {
      void (verificationCode === null ? createCode() : checkGithub());
    }
  };

  return (
    <form
      data-testid="connect-account-sheet"
      onSubmit={submit}
      style={{ animation: "riseIn .4s ease" }}
    >
      {step === "providers" && (
        <>
          <div style={{ textAlign: "center" }}>
            <div className="sheet-title">Connect an account</div>
            <div className="sheet-lead">Choose a service to link with {card.name}.</div>
          </div>
          <div className="panel" style={{ marginTop: 20 }}>
            {PROOF_ORDER.map((provider) => {
              const meta = PROVIDER_META[provider];
              const available = availableProviders.includes(provider);
              const existing = (card.proofs ?? []).find((proof) => proof.provider === provider);
              const connected = existing?.verificationCode !== undefined;
              const needsUpgrade = existing !== undefined && !connected;
              return (
                <button
                  type="button"
                  key={provider}
                  data-testid={`connect-provider-${provider}`}
                  className={available && !connected ? "row press" : "row"}
                  disabled={!available || connected}
                  onClick={() => choose(provider)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom: "1px solid var(--kc-border)",
                    background: "transparent",
                    textAlign: "left",
                    opacity: available && !connected ? 1 : 0.55,
                    cursor: available && !connected ? "pointer" : "not-allowed",
                    padding: "13px 16px",
                  }}
                >
                  <div className="row-icon" style={{ background: meta.bg }}>
                    <ProviderIcon provider={provider} />
                  </div>
                  <div className="row-body">
                    <div className="row-title">{meta.name}</div>
                    <div className="row-sub">
                      {connected
                        ? "Already connected"
                        : needsUpgrade
                          ? "Update verification"
                          : available
                            ? "Check profile ownership"
                            : "Not available yet"}
                    </div>
                  </div>
                  {!available && <ComingSoon />}
                  {connected && <span style={{ fontSize: 12, fontWeight: 700 }}>Connected</span>}
                </button>
              );
            })}
          </div>
          <div className="sheet-note" style={{ marginTop: 12 }}>
            GitHub can be checked directly from this app. Other services need a secure sign-in
            service and are coming soon.
          </div>
        </>
      )}

      {(step === "github" || step === "code" || step === "checking") && (
        <>
          <div style={{ textAlign: "center" }}>
            <div className="sheet-title">Confirm your GitHub profile</div>
            <div className="sheet-lead">
              Create a verification code, add it to your public GitHub bio, then check it here.
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="sec-label" style={{ marginBottom: 8 }}>
              GitHub username
            </div>
            <input
              data-testid="connect-github-username"
              className="input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. octocat"
              value={username}
              onInput={(event) => {
                setUsername(event.currentTarget.value);
                setVerificationCode(null);
                setStep("github");
              }}
              disabled={step === "checking"}
            />
          </div>
          {verificationCode !== null && (
            <>
              <div
                data-testid="connect-github-code"
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 16,
                  background: "var(--kc-surface-raised)",
                  border: "1px solid var(--kc-border)",
                }}
              >
                <div className="sec-label">Your signed verification code</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 7,
                  }}
                >
                  <code
                    style={{
                      flex: 1,
                      color: "var(--kc-heading)",
                      fontSize: 13,
                      fontWeight: 800,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {verificationCode}
                  </code>
                  <button
                    type="button"
                    data-testid="connect-github-copy"
                    aria-label="Copy code"
                    onClick={() => void copyCode()}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--kc-muted)",
                      padding: 6,
                      cursor: "pointer",
                    }}
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>
              <a
                data-testid="connect-github-settings"
                href={githubProfileSettingsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-light press"
                style={{
                  display: "block",
                  marginTop: 12,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                Open GitHub profile settings
              </a>
            </>
          )}
          {error !== null && (
            <div data-testid="connect-github-error" className="form-error">
              {error}
            </div>
          )}
          <button
            type="submit"
            data-testid={
              verificationCode === null ? "connect-github-create-code" : "connect-github-check"
            }
            className="btn-dark press"
            disabled={step === "checking"}
            onClick={() => void (verificationCode === null ? createCode() : checkGithub())}
            style={{ marginTop: 12, opacity: step === "checking" ? 0.55 : 1 }}
          >
            {step === "checking"
              ? "Checking profile…"
              : verificationCode === null
                ? "Create verification code"
                : "Check profile"}
          </button>
          <button
            type="button"
            data-testid="connect-account-back"
            onClick={() => {
              setError(null);
              setStep("providers");
            }}
            style={{
              display: "block",
              margin: "14px auto 0",
              border: "none",
              background: "transparent",
              color: "var(--kc-muted)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Choose another service
          </button>
        </>
      )}

      {step === "done" && (
        <div data-testid="connect-account-complete" className="done-pop">
          <div className="check-bubble">
            <CheckIcon size={44} width={3} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 20 }}>GitHub connected</div>
          <div className="sheet-lead" style={{ maxWidth: 280 }}>
            {username} is now linked with {card.name} on this device.
          </div>
          <button
            type="button"
            data-testid="connect-account-done"
            className="btn-dark press"
            onClick={() => {
              if (identity !== null && verificationCode !== null) {
                onVerified({ username, verificationCode, identity });
              }
            }}
            style={{ marginTop: 24 }}
          >
            Done
          </button>
        </div>
      )}
    </form>
  );
};
