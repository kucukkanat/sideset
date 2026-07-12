import { type Card, PROVIDER_META, type ProviderId, paletteFor } from "@keychain/core";
import {
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { CardAvatar } from "../components/CardAvatar.tsx";
import {
  BackIcon,
  CopyIcon,
  EditIcon,
  PlusIcon,
  ProviderIcon,
  ShareIcon,
  ShieldIcon,
} from "../icons.tsx";

interface CardDetailProps {
  card: Card;
  isActive: boolean;
  heroRef: RefObject<HTMLDivElement | null>;
  /** Hidden while the flip overlay is mid-morph; revealed imperatively at hand-off. */
  heroHidden: boolean;
  onBack: () => void;
  onEdit: () => void;
  onShare: () => void;
  onBackup: () => void;
  onActivate: () => void;
  onCopyPublicKey: (publicKey: string) => void;
  onCopyPrivateKey: (privateKey: string) => void;
  onDisconnectAccount: (provider: ProviderId) => void;
  onConnectAccount: () => void;
}

export const CardDetail = ({
  card,
  isActive,
  heroRef,
  heroHidden,
  onBack,
  onEdit,
  onShare,
  onBackup,
  onActivate,
  onCopyPublicKey,
  onCopyPrivateKey,
  onDisconnectAccount,
  onConnectAccount,
}: CardDetailProps): ReactElement => {
  const pal = paletteFor(card.color);
  const identity = card.identity;
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isHoldingVault, setIsHoldingVault] = useState(false);
  const [isCopyArmed, setIsCopyArmed] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sealTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelHold = (): void => {
    clearTimeout(holdTimer.current);
    setIsHoldingVault(false);
  };
  const sealVault = (): void => {
    clearTimeout(sealTimer.current);
    setIsVaultOpen(false);
    setIsCopyArmed(false);
  };
  const beginHold = (): void => {
    if (isVaultOpen || isHoldingVault) return;
    setIsHoldingVault(true);
    holdTimer.current = setTimeout(() => {
      setIsHoldingVault(false);
      setIsVaultOpen(true);
      sealTimer.current = setTimeout(sealVault, 30_000);
    }, 1_200);
  };
  const handleVaultKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) beginHold();
  };
  const handleVaultKeyUp = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === "Enter" || event.key === " ") cancelHold();
  };
  useEffect(
    () => () => {
      clearTimeout(holdTimer.current);
      clearTimeout(sealTimer.current);
    },
    [],
  );
  return (
    <div
      data-testid={`screen-card-detail-${card.id}`}
      className="scr screen"
      style={{ padding: "0 0 118px", animationDuration: ".3s", background: "#F4EFE8" }}
    >
      <div
        ref={heroRef}
        className="detail-hero"
        style={{
          background: pal.grad,
          opacity: heroHidden ? 0 : 1,
          pointerEvents: heroHidden ? "none" : "auto",
        }}
      >
        <div className="hero-sheen" />
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 2,
          }}
        >
          <button
            data-testid="card-detail-back"
            type="button"
            aria-label="Back to wallet"
            className="hero-btn press"
            style={{ border: "none", color: "inherit", ["--press" as string]: 0.9 }}
            onClick={onBack}
          >
            <BackIcon />
          </button>
          <button
            data-testid="card-detail-edit"
            type="button"
            aria-label={`Edit ${card.name}`}
            className="hero-btn press"
            style={{ border: "none", color: "inherit", ["--press" as string]: 0.9 }}
            onClick={onEdit}
          >
            <EditIcon />
          </button>
        </div>
        <div className="hero-id">
          <CardAvatar card={card} className="hero-avatar" />
          <div className="hero-name">{card.name}</div>
          <div className="hero-tag">{card.tag}</div>
          <div className="hero-bio">{card.bio || "No bio yet — tap edit to add one."}</div>
        </div>
      </div>

      <div data-testid="card-detail-profile" style={{ padding: "20px 24px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Profile</div>
        <div className="panel">
          <div className="row" style={{ padding: "13px 16px" }}>
            <div className="row-body">
              <div className="row-title ellip">@{card.username}</div>
              <div className="row-sub">Username</div>
            </div>
          </div>
          {card.email && (
            <div className="row" style={{ padding: "13px 16px" }}>
              <div className="row-body">
                <div className="row-title ellip">{card.email}</div>
                <div className="row-sub">Email</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "18px 24px 4px" }}>
        {isActive ? (
          <div
            data-testid="card-detail-activate"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "#E9F7EC",
              color: "#1E8A4C",
              borderRadius: 16,
              padding: 14,
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#28B463",
                boxShadow: "0 0 8px #28B463",
              }}
            />
            This card is active
          </div>
        ) : (
          <div
            role="button"
            className="btn-dark press"
            onClick={onActivate}
            style={{
              padding: 15,
              fontSize: 14.5,
              boxShadow: "0 8px 20px -8px rgba(0,0,0,.4)",
              ["--press" as string]: 0.97,
            }}
          >
            Switch to this card
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: "12px 24px 4px",
        }}
      >
        <div
          data-testid="card-detail-share"
          role="button"
          className="action-tile press"
          onClick={onShare}
        >
          <div className="ico" style={{ background: "#FFEDE7" }}>
            <ShareIcon />
          </div>
          <div className="lbl">Share</div>
        </div>
        <div
          data-testid="card-detail-backup"
          role="button"
          className="action-tile press"
          onClick={onBackup}
        >
          <div className="ico" style={{ background: "#E8F0FF" }}>
            <ShieldIcon />
          </div>
          <div className="lbl">Export backup</div>
        </div>
      </div>

      <div data-testid="card-detail-accounts" style={{ padding: "22px 24px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Connected accounts</div>
        <div className="panel">
          {(card.proofs ?? []).map((proof) => {
            const meta = PROVIDER_META[proof.provider];
            return (
              <div
                data-testid={`card-account-${proof.provider}`}
                key={proof.provider}
                className="row"
                style={{ padding: "13px 16px" }}
              >
                <div className="row-icon" style={{ background: meta.bg }}>
                  <ProviderIcon provider={proof.provider} />
                </div>
                <div className="row-body">
                  <div className="row-title ellip">{proof.username}</div>
                  <div className="row-sub" style={{ fontSize: 11.5, marginTop: 1 }}>
                    Connected via {meta.name}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`card-account-${proof.provider}-disconnect`}
                  className="press"
                  onClick={() => onDisconnectAccount(proof.provider)}
                  style={{
                    border: "none",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#D14B2E",
                    background: "#FDECE7",
                    padding: "7px 12px",
                    borderRadius: 20,
                    flex: "0 0 auto",
                    ["--press" as string]: 0.94,
                  }}
                >
                  Disconnect
                </button>
              </div>
            );
          })}
          <button
            type="button"
            data-testid="card-connect-account"
            className="row"
            onClick={onConnectAccount}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div
              className="row-icon"
              style={{ color: "var(--kc-text)", background: "var(--kc-surface-raised)" }}
            >
              <PlusIcon size={20} />
            </div>
            <div
              data-theme-text="muted"
              style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--kc-muted)" }}
            >
              Connect account
            </div>
          </button>
        </div>
      </div>

      {identity !== undefined && (
        <section data-testid="card-detail-keys" className="card-keys">
          <div className="card-keys-heading">
            <div>
              <div className="card-keys-title">Keys</div>
              <div className="card-keys-subtitle">Your identity, under your control.</div>
            </div>
            <div className="card-keys-shield" aria-hidden="true">
              <ShieldIcon />
            </div>
          </div>

          <button
            data-testid="card-detail-copy-public-key"
            type="button"
            aria-label={`Copy ${card.name}'s public key`}
            className="card-key-row press"
            onClick={() => onCopyPublicKey(identity.publicKey)}
          >
            <div className="card-key-kind">Public key</div>
            <code>{identity.publicKey}</code>
            <div className="card-key-action">
              Safe to share <CopyIcon />
            </div>
          </button>

          <div className={`key-vault${isVaultOpen ? " is-open" : ""}`}>
            <div className="key-vault-topline">
              <div>
                <div className="card-key-kind">Private key</div>
                <div className="key-vault-warning">Anyone with this key can become you.</div>
              </div>
              <div className="key-vault-status">{isVaultOpen ? "Vault open" : "Sealed"}</div>
            </div>

            {isVaultOpen ? (
              <>
                <code data-testid="card-detail-private-key" className="key-vault-secret">
                  {identity.privateKey}
                </code>
                <div className="key-vault-timer">Auto-seals in 30 seconds</div>
                <div className="key-vault-actions">
                  <button
                    data-testid="card-detail-seal-private-key"
                    type="button"
                    className="key-vault-secondary press"
                    onClick={sealVault}
                  >
                    Seal now
                  </button>
                  {isCopyArmed ? (
                    <button
                      data-testid="card-detail-confirm-copy-private-key"
                      type="button"
                      className="key-vault-copy press"
                      onClick={() => {
                        onCopyPrivateKey(identity.privateKey);
                        sealVault();
                      }}
                    >
                      <CopyIcon /> Copy &amp; seal
                    </button>
                  ) : (
                    <button
                      data-testid="card-detail-arm-copy-private-key"
                      type="button"
                      className="key-vault-copy press"
                      onClick={() => setIsCopyArmed(true)}
                    >
                      Arm copy
                    </button>
                  )}
                </div>
                {isCopyArmed && (
                  <div className="key-vault-confirmation">
                    Final check: nobody else can see your screen.
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="key-vault-concealed" aria-hidden="true">
                  •••• •••• •••• ••••
                </div>
                <button
                  data-testid="card-detail-reveal-private-key"
                  type="button"
                  className="key-vault-hold"
                  data-holding={isHoldingVault}
                  onPointerDown={beginHold}
                  onPointerUp={cancelHold}
                  onPointerCancel={cancelHold}
                  onPointerLeave={cancelHold}
                  onKeyDown={handleVaultKeyDown}
                  onKeyUp={handleVaultKeyUp}
                >
                  <span className="key-vault-hold-fill" />
                  <span className="key-vault-hold-label">
                    {isHoldingVault ? "Keep holding…" : "Hold to open vault"}
                  </span>
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
