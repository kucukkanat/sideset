import { type Contact, PROVIDER_META, paletteFor } from "@keychain/core";
import type { ReactElement, RefObject } from "react";
import { BackIcon, CheckIcon, CopyIcon, MessageIcon, ProviderIcon, ShareIcon } from "../icons.tsx";

interface ContactDetailProps {
  contact: Contact;
  heroRef: RefObject<HTMLDivElement | null>;
  heroHidden: boolean;
  onBack: () => void;
  onToast: (msg: string) => void;
}

export const ContactDetail = ({
  contact,
  heroRef,
  heroHidden,
  onBack,
  onToast,
}: ContactDetailProps): ReactElement => {
  const pal = paletteFor(contact.color);
  const share = (): void => onToast(`${contact.name} shared`);
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
            onClick={share}
          >
            <ShareIcon stroke="#fff" />
          </div>
        </div>
        <div className="hero-id">
          <div className="hero-avatar">{contact.avatar}</div>
          <div className="hero-name">{contact.name}</div>
          <div className="hero-tag">{contact.handle}</div>
          <div className="hero-bio">{contact.bio || "No bio yet."}</div>
        </div>
      </div>

      <div style={{ padding: "18px 24px 4px" }}>
        <div
          role="button"
          className="btn-dark press"
          onClick={() => onToast(`Opening chat with ${contact.name}`)}
          style={{
            padding: 15,
            fontSize: 14.5,
            boxShadow: "0 8px 20px -8px rgba(0,0,0,.4)",
            ["--press" as string]: 0.97,
          }}
        >
          <MessageIcon />
          Message {contact.handle}
        </div>
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
          role="button"
          className="action-tile press"
          onClick={() => onToast(`Send a tip to ${contact.name}`)}
        >
          <div className="ico" style={{ background: "#FFF6DB" }}>
            ⚡
          </div>
          <div className="lbl">Send tip</div>
        </div>
        <div role="button" className="action-tile press" onClick={share}>
          <div className="ico" style={{ background: "#FFEDE7" }}>
            <ShareIcon />
          </div>
          <div className="lbl">Share</div>
        </div>
      </div>

      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Public key</div>
        <div
          role="button"
          className="press"
          onClick={() => onToast("Public key copied")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            background: "#FFF",
            borderRadius: 18,
            padding: "15px 16px",
            boxShadow: "0 4px 14px -8px rgba(80,50,20,.2)",
            ["--press" as string]: 0.98,
          }}
        >
          <div className="row-icon" style={{ background: "#EFEAF7" }}>
            🔑
          </div>
          <div className="row-body">
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                fontFamily: "ui-monospace,Menlo,monospace",
                color: "#241F1B",
              }}
            >
              {contact.npub}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#A08E78", marginTop: 2 }}>
              Tap to copy
            </div>
          </div>
          <CopyIcon />
        </div>
      </div>

      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Verified identities</div>
        <div className="panel">
          {contact.proofs.map((proof) => {
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
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#E9F7EC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                >
                  <CheckIcon />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
