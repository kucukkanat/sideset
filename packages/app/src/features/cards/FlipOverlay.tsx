import { type Card, type Contact, paletteFor } from "@keychain/core";
import { FALLBACK_CARD_RECT, type Flip } from "@shared/lib/flip.ts";
import { BackIcon, EditIcon } from "@shared/ui/icons.tsx";
import type { CSSProperties, ReactElement } from "react";
import { CardAvatar } from "./CardAvatar.tsx";
import { CardFace } from "./CardFace.tsx";

const isContact = (s: Card | Contact): s is Contact => "mutuals" in s;

/**
 * The morphing overlay for the card ⇄ detail-hero transition. It renders both
 * faces of the flip (card front, hero clone back) and animates position, size,
 * radius and rotateY from `flip.rect` to `flip.target` in a single transition.
 */
export const FlipOverlay = ({
  flip,
  subject,
}: {
  flip: Flip;
  subject: Card | Contact;
}): ReactElement => {
  const pal = paletteFor(subject.color);
  const contact = isContact(subject);
  const tag = contact ? subject.handle : subject.tag;
  const bio = subject.bio || "No bio yet — tap edit to add one.";

  const box = flip.phase === "end" && flip.target ? flip.target : (flip.rect ?? FALLBACK_CARD_RECT);
  const isEnd = flip.phase === "end" && flip.target !== null;
  const rev = flip.dir === "rev";
  // fwd: rotateY 0 → -180, radius 24 → 0.  rev: rotateY -180 → 0, radius 0 → 24.
  const deg = rev ? (isEnd ? 0 : -180) : isEnd ? -180 : 0;
  const radius = rev ? (isEnd ? 24 : 0) : isEnd ? 0 : 24;
  const ease = "cubic-bezier(.5,.02,.2,1)";
  const inner: CSSProperties = {
    position: "absolute",
    top: box.top,
    left: box.left,
    width: box.w,
    height: box.h,
    borderRadius: radius,
    transformStyle: "preserve-3d",
    transform: `rotateY(${deg}deg)`,
    willChange: "top,left,width,height,transform",
    transition: isEnd
      ? `top .56s ${ease},left .56s ${ease},width .56s ${ease},height .56s ${ease},border-radius .56s ${ease},transform .58s ${ease},box-shadow .56s ${ease}`
      : "none",
  };
  const face: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    overflow: "hidden",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    background: pal.grad,
  };

  return (
    <div
      data-testid="flip-overlay"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        perspective: 1700,
        zIndex: 78,
        pointerEvents: "none",
      }}
    >
      <div data-testid="flip-card" style={inner}>
        {/* FRONT: the card as it sat in the stack */}
        {contact ? (
          <div
            style={{
              ...face,
              boxShadow: `0 30px 60px -20px ${pal.shadow},0 0 0 1px rgba(255,255,255,.14) inset`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-40%",
                left: "-20%",
                width: "80%",
                height: "120%",
                background: "radial-gradient(closest-side, rgba(255,255,255,.28), transparent)",
                transform: "rotate(20deg)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                color: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 26,
                    background: "rgba(255,255,255,.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 44,
                    boxShadow: "0 0 0 1px rgba(255,255,255,.25) inset",
                  }}
                >
                  {!("mutuals" in subject) ? (
                    <CardAvatar card={subject} style={{ width: "100%", height: "100%" }} />
                  ) : (
                    <CardAvatar
                      card={subject}
                      seed={subject.npub || subject.id}
                      style={{ width: "100%", height: "100%" }}
                    />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{subject.name}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, opacity: 0.82, marginTop: 4 }}>
                    {tag}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.95 }}>
                {subject.mutuals} mutual
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...face, overflow: "visible", background: "transparent" }}>
            {/* Card detail is only entered from the active carousel card. */}
            <CardFace card={subject} active borderRadius="inherit" />
          </div>
        )}
        {/* BACK: an exact clone of the detail hero, so the swap is invisible */}
        <div
          className="flip-detail-hero"
          style={{
            ...face,
            transform: "rotateY(180deg)",
            boxShadow: `0 30px 60px -20px ${pal.shadow}`,
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
            <div className="hero-btn" style={{ backdropFilter: "none" }}>
              <BackIcon />
            </div>
            <div className="hero-btn" style={{ backdropFilter: "none" }}>
              <EditIcon />
            </div>
          </div>
          <div className="hero-id">
            <div className="hero-avatar" style={{ backdropFilter: "none" }}>
              {!("mutuals" in subject) ? (
                <CardAvatar card={subject} style={{ width: "100%", height: "100%" }} />
              ) : (
                <CardAvatar
                  card={subject}
                  seed={subject.npub || subject.id}
                  style={{ width: "100%", height: "100%" }}
                />
              )}
            </div>
            <div className="hero-name">{subject.name}</div>
            <div className="hero-tag">{tag}</div>
            <div className="hero-bio">{bio}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
