import {
  type Card,
  cardPlacement,
  dampDrag,
  dragFraction,
  greetingFor,
  PROVIDER_META,
  type Proof,
  searchCards,
  signedDistance,
  wrapIndex,
} from "@keychain/core";
import { Search, X } from "lucide-react";
import {
  type MutableRefObject,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import darkBrandLogo from "../../assets/brand/sideset-logo-dark.png";
import lightBrandLogo from "../../assets/brand/sideset-logo-light.png";
import type { ActivityItem } from "../activity.ts";
import { ActivityRow } from "../components/ActivityRow.tsx";
import { CardAvatar } from "../components/CardAvatar.tsx";
import { CardFace } from "../components/CardFace.tsx";
import { ComingSoon } from "../components/ComingSoon.tsx";
import { CheckIcon, LinkIcon, PlusIcon, ProviderIcon } from "../icons.tsx";

const CARD_W = 350;
const CARD_H = 214;
const CAR_EASE = "cubic-bezier(.34,1.06,.34,1)";

interface HomeProps {
  cards: readonly Card[];
  activeId: string;
  active: Card;
  carIndex: number;
  onCarIndex: (i: number) => void;
  interactive: boolean;
  hideFrontCard: boolean;
  frontCardRef: MutableRefObject<HTMLDivElement | null>;
  onOpenDetail: (id: string, el: HTMLElement | null) => void;
  onImport: () => void;
  onCreate: () => void;
  onConnectAccount: () => void;
  onSeeActivity: () => void;
  onAccountTap: (account: Proof) => void;
  recentActivity: readonly ActivityItem[];
}

export const Home = ({
  cards,
  activeId,
  active,
  carIndex,
  onCarIndex,
  interactive,
  hideFrontCard,
  frontCardRef,
  onOpenDetail,
  onImport,
  onCreate,
  onConnectAccount,
  onSeeActivity,
  onAccountTap,
  recentActivity,
}: HomeProps): ReactElement => {
  const [drag, setDrag] = useState({ x: 0, dragging: false });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement | null>(null);
  const moved = useRef(false);
  const n = cards.length;
  const front = wrapIndex(carIndex, n);
  const pos = front + (drag.dragging ? dragFraction(drag.x) : 0);
  const searchResults = useMemo(() => searchCards(cards, query), [cards, query]);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

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
    <div data-testid="screen-home" className="scr screen">
      <div className="screen-hdr">
        <div className="home-brand">
          <div className="home-brand-lockup" role="img" aria-label="Sideset">
            <img className="home-brand-logo home-brand-logo-light" src={lightBrandLogo} alt="" />
            <img className="home-brand-logo home-brand-logo-dark" src={darkBrandLogo} alt="" />
          </div>
          <div className="hdr-sub">{greetingFor(new Date().getHours())}</div>
        </div>
        <div className="home-header-actions">
          <button
            type="button"
            data-testid="home-search-identities"
            aria-label={searchOpen ? "Close identity search" : "Search identities"}
            aria-expanded={searchOpen}
            className="round-btn press"
            onClick={() => {
              setSearchOpen((open) => !open);
              setQuery("");
            }}
          >
            {searchOpen ? (
              <X aria-hidden="true" size={21} />
            ) : (
              <Search aria-hidden="true" size={21} />
            )}
          </button>
          <button
            type="button"
            data-testid="home-import-profile"
            aria-label="Import a profile"
            className="round-btn press"
            style={{ border: "none", ["--press" as string]: 0.9 }}
            onClick={onImport}
          >
            <PlusIcon stroke="var(--kc-heading)" size={22} width={2.2} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div data-testid="home-identity-search" className="home-identity-search">
          <div className="home-identity-search-input">
            <Search aria-hidden="true" size={18} />
            <input
              data-testid="home-identity-search-input"
              ref={searchInput}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={`Search ${cards.length} ${cards.length === 1 ? "identity" : "identities"}`}
              aria-label="Search your identities"
            />
          </div>
          {query.trim().length > 0 && (
            <div
              data-testid="home-identity-search-results"
              className="home-identity-search-results"
            >
              {searchResults.length === 0 ? (
                <div className="home-identity-search-empty">No identities found</div>
              ) : (
                searchResults.map((card) => (
                  <button
                    type="button"
                    data-testid={`home-identity-search-result-${card.id}`}
                    key={card.id}
                    onClick={() => {
                      onCarIndex(cards.indexOf(card));
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <CardAvatar card={card} style={{ width: 38, height: 38 }} />
                    <span>
                      <strong>{card.name}</strong>
                      <small>{card.username || card.handle}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* CARD CAROUSEL */}
      <div
        data-testid="home-card-carousel"
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
            const rel = signedDistance(i, pos, n);
            const isFront = i === front;
            const pl = cardPlacement(rel);
            return (
              <div
                data-testid={`home-card-${c.id}`}
                key={c.id}
                role="button"
                tabIndex={pl.opacity === 0 ? -1 : 0}
                aria-current={isFront ? "true" : undefined}
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
                  else onOpenDetail(c.id, e.currentTarget);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (!isFront) onCarIndex(i);
                  else onOpenDetail(c.id, event.currentTarget);
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
                  visibility: isFront && hideFrontCard ? "hidden" : "visible",
                  cursor: "pointer",
                  transition: drag.dragging
                    ? "none"
                    : `transform .6s ${CAR_EASE},opacity .45s ease`,
                  willChange: "transform",
                }}
              >
                <CardFace
                  card={c}
                  active={c.id === activeId}
                  dim={pl.dim}
                  dimTransition={drag.dragging ? "none" : `opacity .6s ${CAR_EASE}`}
                />
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
            <button
              type="button"
              key={c.id}
              data-testid={`home-card-indicator-${c.id}`}
              aria-label={`Show ${c.name} card`}
              aria-pressed={i === front}
              onClick={() => onCarIndex(i)}
              style={{
                border: 0,
                padding: 0,
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
        data-testid="home-quick-actions"
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
              available: true,
            },
            {
              label: "Connect account",
              bg: "#E8F0FF",
              icon: <LinkIcon />,
              available: true,
              onTap: onConnectAccount,
            },
          ] as const
        ).map((q) => (
          <button
            type="button"
            key={q.label}
            data-testid={`home-action-${q.label.toLowerCase().replaceAll(" ", "-")}`}
            data-theme-surface="card"
            className={q.available ? "press" : undefined}
            disabled={!q.available}
            aria-disabled={!q.available}
            onClick={q.available ? q.onTap : undefined}
            style={{
              background: "var(--kc-surface)",
              border: "none",
              borderRadius: 18,
              padding: "14px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 3px 10px -4px rgba(80,50,20,.16)",
              opacity: q.available ? 1 : 0.5,
              cursor: q.available ? "pointer" : "not-allowed",
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
            <div
              data-theme-text="primary"
              style={{ fontSize: 12.5, fontWeight: 700, color: "var(--kc-text)" }}
            >
              {q.label}
            </div>
            {!q.available && <ComingSoon />}
          </button>
        ))}
      </div>

      {/* CONNECTED ACCOUNTS */}
      <div data-testid="home-connected-accounts" style={{ padding: "22px 0 4px" }}>
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
              Connected accounts
            </div>
            <div
              data-theme-text="muted"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--kc-subtle)", marginTop: 2 }}
            >
              Accounts shown on this card
            </div>
          </div>
          <div
            data-theme-text="muted"
            style={{ fontSize: 13, fontWeight: 700, color: "var(--kc-subtle)" }}
          >
            {active.name}
          </div>
        </div>
        <div
          className="scr"
          style={{ display: "flex", gap: 12, overflowX: "auto", padding: "2px 24px 6px" }}
        >
          {(active.proofs ?? []).map((proof) => {
            const meta = PROVIDER_META[proof.provider];
            return (
              <button
                type="button"
                key={proof.provider}
                data-testid={`home-account-${proof.provider}`}
                data-theme-surface="card"
                className="press"
                onClick={() => onAccountTap(proof)}
                style={{
                  flex: "0 0 auto",
                  width: 110,
                  background: "var(--kc-surface)",
                  border: "none",
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
                      color: "var(--kc-text)",
                      lineHeight: 1.1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {proof.username}
                  </div>
                  <div
                    data-theme-text="muted"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "var(--kc-subtle)",
                      marginTop: 2,
                    }}
                  >
                    {meta.name}
                  </div>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            data-testid="home-connect-account"
            data-theme-surface="card"
            onClick={onConnectAccount}
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
              color: "var(--kc-subtle)",
              cursor: "pointer",
              fontFamily: "inherit",
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
              Connect account
            </div>
          </button>
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div data-testid="home-recent-activity" style={{ padding: "22px 24px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Recent</div>
          <button
            type="button"
            data-testid="home-see-all-activity"
            onClick={onSeeActivity}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--kc-accent, #E8502A)",
              cursor: "pointer",
            }}
          >
            See all
          </button>
        </div>
        <div className="panel">
          {recentActivity.length > 0 ? (
            recentActivity.map((item) => <ActivityRow key={item.id} item={item} />)
          ) : (
            <div className="row-sub" style={{ padding: 18, textAlign: "center" }}>
              Your latest changes will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
