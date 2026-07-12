import { type Card, PROVIDER_META, type ProviderId, paletteFor } from "@keychain/core";
import type { ReactElement, RefObject } from "react";
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
  onDisconnectAccount,
  onConnectAccount,
}: CardDetailProps): ReactElement => {
  const pal = paletteFor(card.color);
  const identity = card.identity;
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
          <div className="hero-avatar">{card.avatar}</div>
          <div className="hero-name">{card.name}</div>
          <div className="hero-tag">{card.tag}</div>
          <div className="hero-bio">{card.bio || "No bio yet — tap edit to add one."}</div>
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

      {identity !== undefined && (
        <div data-testid="card-detail-public-key" style={{ padding: "20px 24px 0" }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Public key</div>
          <button
            data-testid="card-detail-copy-public-key"
            data-theme-surface="card"
            type="button"
            aria-label={`Copy ${card.name}'s public key`}
            className="press"
            onClick={() => onCopyPublicKey(identity.publicKey)}
            style={{
              width: "100%",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 13,
              background: "var(--kc-surface)",
              borderRadius: 18,
              padding: "15px 16px",
              boxShadow: "0 4px 14px -8px rgba(80,50,20,.2)",
              textAlign: "left",
              ["--press" as string]: 0.98,
            }}
          >
            <div className="row-icon" style={{ background: "#EFEAF7" }}>
              🔑
            </div>
            <div className="row-body">
              <code
                style={{
                  display: "block",
                  color: "var(--kc-text)",
                  fontSize: 12.5,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {identity.publicKey}
              </code>
              <div
                data-theme-text="muted"
                style={{ fontSize: 11.5, fontWeight: 600, color: "var(--kc-subtle)", marginTop: 2 }}
              >
                Tap to copy
              </div>
            </div>
            <CopyIcon />
          </button>
        </div>
      )}

      <div data-testid="card-detail-accounts" style={{ padding: "22px 24px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Connected accounts</div>
        <div className="panel">
          {card.proofs.map((proof) => {
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
            <div className="row-icon" style={{ background: "#EFE7DB" }}>
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
    </div>
  );
};
