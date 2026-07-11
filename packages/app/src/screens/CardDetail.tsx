import { type Card, PROVIDER_META, type ProviderId, paletteFor } from "@keychain/core";
import type { ReactElement, RefObject } from "react";
import {
  BackIcon,
  ChevronIcon,
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
  onRemoveProof: (provider: ProviderId) => void;
  onAddProof: () => void;
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
  onRemoveProof,
  onAddProof,
}: CardDetailProps): ReactElement => {
  const pal = paletteFor(card.color);
  return (
    <div
      className="scr screen"
      style={{ padding: "0 0 118px", animationDuration: ".3s", background: "#F4EFE8" }}
    >
      <div
        ref={heroRef}
        className="detail-hero"
        style={{ background: pal.grad, opacity: heroHidden ? 0 : 1 }}
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
          <div
            role="button"
            className="hero-btn press"
            style={{ ["--press" as string]: 0.9 }}
            onClick={onBack}
          >
            <BackIcon />
          </div>
          <div
            role="button"
            className="hero-btn press"
            style={{ ["--press" as string]: 0.9 }}
            onClick={onEdit}
          >
            <EditIcon />
          </div>
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
        <div role="button" className="action-tile press" onClick={onShare}>
          <div className="ico" style={{ background: "#FFEDE7" }}>
            <ShareIcon />
          </div>
          <div className="lbl">Share</div>
        </div>
        <div role="button" className="action-tile press" onClick={onBackup}>
          <div className="ico" style={{ background: "#E8F0FF" }}>
            <ShieldIcon />
          </div>
          <div className="lbl">Back up</div>
        </div>
      </div>

      <div style={{ padding: "22px 24px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Verified identities</div>
        <div className="panel">
          {card.proofs.map((proof) => {
            const meta = PROVIDER_META[proof.provider];
            return (
              <div key={proof.provider} className="row" style={{ padding: "13px 16px" }}>
                <div className="row-icon" style={{ background: meta.bg }}>
                  <ProviderIcon provider={proof.provider} />
                </div>
                <div className="row-body">
                  <div className="row-title ellip">{proof.username}</div>
                  <div className="row-sub" style={{ fontSize: 11.5, marginTop: 1 }}>
                    Verified on {meta.name}
                  </div>
                </div>
                <div
                  role="button"
                  className="press"
                  onClick={() => onRemoveProof(proof.provider)}
                  style={{
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
                  Remove
                </div>
              </div>
            );
          })}
          <div
            role="button"
            className="row press"
            onClick={onAddProof}
            style={{ ["--press" as string]: 0.99 }}
          >
            <div className="row-icon" style={{ background: "#EFE7DB" }}>
              <PlusIcon size={20} />
            </div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#8A7A64" }}>
              Add a proof
            </div>
            <ChevronIcon />
          </div>
        </div>
      </div>
    </div>
  );
};
