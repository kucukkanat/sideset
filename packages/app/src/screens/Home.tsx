import {
  type Card,
  cardPlacement,
  dampDrag,
  dragFraction,
  greetingFor,
  PROVIDER_META,
  type Proof,
  paletteFor,
  proofsSummary,
  signedDistance,
  wrapIndex,
} from "@keychain/core";
import { type MutableRefObject, type ReactElement, useRef, useState } from "react";
import { RECENT_ACTIVITY } from "../activity.ts";
import { ActivityRow } from "../components/ActivityRow.tsx";
import { CheckIcon, LinkIcon, PersonIcon, PlusIcon, ProviderIcon, ScanIcon } from "../icons.tsx";

const CARD_W = 250;
const CARD_H = 214;
const CAR_EASE = "cubic-bezier(.34,1.06,.34,1)";

interface HomeProps {
  cards: readonly Card[];
  activeId: string;
  active: Card;
  carIndex: number;
  onCarIndex: (i: number) => void;
  interactive: boolean;
  frontCardRef: MutableRefObject<HTMLDivElement | null>;
  onActivate: (card: Card) => void;
  onOpenDetail: (id: string, el: HTMLElement | null) => void;
  onAddProof: () => void;
  onCreate: () => void;
  onSeeActivity: () => void;
  onProofTap: (proof: Proof) => void;
}

export const Home = ({
  cards,
  activeId,
  active,
  carIndex,
  onCarIndex,
  interactive,
  frontCardRef,
  onActivate,
  onOpenDetail,
  onAddProof,
  onCreate,
  onSeeActivity,
  onProofTap,
}: HomeProps): ReactElement => {
  const [drag, setDrag] = useState({ x: 0, dragging: false });
  const moved = useRef(false);
  const n = cards.length;
  const front = wrapIndex(carIndex, n);
  const pos = front + (drag.dragging ? dragFraction(drag.x) : 0);

  // Swipe: lock to the dominant axis, rubber-band the drag, snap ±1 past 48px.
  const onCarStart = (e: React.PointerEvent): void => {
    if (!interactive) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let locked: "x" | "y" | null = null;
    moved.current = false;
    const cleanup = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    const move = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (locked === null && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) {
        locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (locked === "y") {
          cleanup();
          setDrag({ x: 0, dragging: false });
        }
      }
      if (locked === "x") {
        if (ev.cancelable) ev.preventDefault();
        moved.current = true;
        setDrag({ x: dampDrag(dx), dragging: true });
      }
    };
    const settle = (dx: number): void => {
      if (locked === "x" && Math.abs(dx) > 48) {
        onCarIndex(wrapIndex(carIndex + (dx < 0 ? 1 : -1), n));
      }
      setDrag({ x: 0, dragging: false });
      // Ignore the click event that ends a swipe.
      setTimeout(() => {
        moved.current = false;
      }, 60);
    };
    const up = (ev: PointerEvent): void => {
      cleanup();
      settle(ev.clientX - startX);
    };
    // Touch scrolling fires pointercancel — snap back so the carousel never
    // freezes mid-turn.
    const cancel = (): void => {
      cleanup();
      settle(0);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  return (
    <div className="scr screen">
      <div className="screen-hdr">
        <div>
          <div className="hdr-sub">{greetingFor(new Date().getHours())}</div>
          <div className="hdr-title">Wallet</div>
        </div>
        <div
          role="button"
          className="round-btn press"
          style={{ ["--press" as string]: 0.9 }}
          onClick={onAddProof}
        >
          <ScanIcon />
        </div>
      </div>

      {/* CARD CAROUSEL */}
      <div
        onPointerDown={onCarStart}
        style={{
          position: "relative",
          margin: "20px 0 4px",
          height: 262,
          perspective: 1250,
          perspectiveOrigin: "50% 50%",
          touchAction: "pan-y",
          cursor: "grab",
        }}
      >
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
          {cards.map((c, i) => {
            const p = paletteFor(c.color);
            const rel = signedDistance(i, pos, n);
            const isFront = i === front;
            const pl = cardPlacement(rel);
            return (
              <div
                key={c.id}
                role="button"
                ref={
                  isFront
                    ? (el) => {
                        frontCardRef.current = el;
                      }
                    : null
                }
                onClick={(e) => {
                  if (moved.current) return;
                  if (!isFront) onCarIndex(i);
                  else if (c.id === activeId) onOpenDetail(c.id, e.currentTarget);
                  else onActivate(c);
                }}
                style={{
                  position: "absolute",
                  top: 24,
                  left: "50%",
                  width: CARD_W,
                  height: CARD_H,
                  marginLeft: -CARD_W / 2,
                  transform: `translateX(${pl.x}px) translateZ(${pl.translateZ}px) rotateY(${pl.rotateY}deg) scale(${pl.scale})`,
                  zIndex: pl.zIndex,
                  opacity: pl.opacity,
                  cursor: "pointer",
                  transition: drag.dragging
                    ? "none"
                    : `transform .6s ${CAR_EASE},opacity .45s ease`,
                  willChange: "transform",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 24,
                    background: p.grad,
                    overflow: "hidden",
                    boxShadow: `0 22px 46px -18px ${p.shadow},0 2px 6px rgba(0,0,0,.12),0 0 0 1px rgba(255,255,255,.14) inset`,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "-40%",
                      left: "-20%",
                      width: "80%",
                      height: "120%",
                      background:
                        "radial-gradient(closest-side, rgba(255,255,255,.28), transparent)",
                      transform: "rotate(20deg)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-30%",
                      right: "-15%",
                      width: "60%",
                      height: "90%",
                      background: "radial-gradient(closest-side, rgba(0,0,0,.14), transparent)",
                    }}
                  />
                  {/* dim overlay for off-centre cards */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#0A0908",
                      opacity: pl.dim,
                      transition: drag.dragging ? "none" : `opacity .6s ${CAR_EASE}`,
                      pointerEvents: "none",
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 13,
                            background: "rgba(255,255,255,.22)",
                            backdropFilter: "blur(6px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 22,
                            boxShadow: "0 0 0 1px rgba(255,255,255,.25) inset",
                          }}
                        >
                          {c.avatar}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 700,
                              letterSpacing: -0.2,
                              lineHeight: 1,
                            }}
                          >
                            {c.name}
                          </div>
                          <div
                            style={{ fontSize: 12.5, fontWeight: 500, opacity: 0.82, marginTop: 4 }}
                          >
                            {c.tag}
                          </div>
                        </div>
                      </div>
                      {c.id === activeId && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            background: "rgba(255,255,255,.2)",
                            padding: "5px 10px 5px 8px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.2,
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#8FF0A4",
                              boxShadow: "0 0 8px #8FF0A4",
                            }}
                          />
                          ACTIVE
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            opacity: 0.7,
                            letterSpacing: 1.5,
                          }}
                        >
                          VERIFIED ON
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.95, marginTop: 3 }}>
                          {proofsSummary(c.proofs)}
                        </div>
                      </div>
                      <PersonIcon />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* dots */}
        <div
          style={{
            position: "absolute",
            bottom: 2,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 7,
            zIndex: 5,
          }}
        >
          {cards.map((c, i) => (
            <div
              key={c.id}
              role="button"
              onClick={() => onCarIndex(i)}
              style={{
                width: i === front ? 20 : 7,
                height: 7,
                borderRadius: 4,
                background: i === front ? "#E8502A" : "#CDBFA9",
                cursor: "pointer",
                transition: `all .4s ${CAR_EASE}`,
              }}
            />
          ))}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: "14px 24px 6px",
        }}
      >
        {(
          [
            {
              label: "New card",
              bg: "#E9F7EC",
              icon: <PlusIcon stroke="#1E8A4C" size={18} width={2.2} />,
              onTap: onCreate,
            },
            { label: "Add proof", bg: "#E8F0FF", icon: <LinkIcon />, onTap: onAddProof },
          ] as const
        ).map((q) => (
          <div
            key={q.label}
            role="button"
            className="press"
            onClick={q.onTap}
            style={{
              background: "#FFF",
              borderRadius: 18,
              padding: "14px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 3px 10px -4px rgba(80,50,20,.16)",
              ["--press" as string]: 0.94,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: q.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {q.icon}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#3A322A" }}>{q.label}</div>
          </div>
        ))}
      </div>

      {/* VERIFIED IDENTITIES */}
      <div style={{ padding: "22px 0 4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "0 24px 12px",
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>
              Verified identities
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#A08E78", marginTop: 2 }}>
              Proof this is really you
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#A08E78" }}>{active.name}</div>
        </div>
        <div
          className="scr"
          style={{ display: "flex", gap: 12, overflowX: "auto", padding: "2px 24px 6px" }}
        >
          {active.proofs.map((proof) => {
            const meta = PROVIDER_META[proof.provider];
            return (
              <div
                key={proof.provider}
                role="button"
                className="press"
                onClick={() => onProofTap(proof)}
                style={{
                  flex: "0 0 auto",
                  width: 110,
                  background: "#FFF",
                  borderRadius: 18,
                  padding: "14px 10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 9,
                  boxShadow: "0 3px 10px -5px rgba(80,50,20,.18)",
                  ["--press" as string]: 0.94,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: meta.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 4px 10px -4px ${meta.shadow}`,
                  }}
                >
                  <ProviderIcon provider={proof.provider} />
                  <div
                    style={{
                      position: "absolute",
                      right: -4,
                      bottom: -4,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#28B463",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 0 2.5px #FFF",
                    }}
                  >
                    <CheckIcon size={11} stroke="#fff" />
                  </div>
                </div>
                <div style={{ textAlign: "center", width: "100%" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#241F1B",
                      lineHeight: 1.1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {proof.username}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: "#A08E78", marginTop: 2 }}>
                    {meta.name}
                  </div>
                </div>
              </div>
            );
          })}
          <div
            role="button"
            className="press"
            onClick={onAddProof}
            style={{
              flex: "0 0 auto",
              width: 110,
              background: "transparent",
              border: "2px dashed #C9BBA6",
              borderRadius: 18,
              padding: "14px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              color: "#A08E78",
              ["--press" as string]: 0.94,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: "#EFE7DB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlusIcon />
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, textAlign: "center", lineHeight: 1.15 }}>
              Add proof
            </div>
          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div style={{ padding: "22px 24px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Recent</div>
          <div
            role="button"
            onClick={onSeeActivity}
            style={{ fontSize: 13, fontWeight: 700, color: "#E8502A", cursor: "pointer" }}
          >
            See all
          </div>
        </div>
        <div className="panel">
          {RECENT_ACTIVITY.map((item) => (
            <ActivityRow key={item.title} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};
