import { ActivityRow } from "@features/activity/ActivityRow.tsx";
import type { ActivityItem } from "@features/activity/activity.ts";
import { CardAvatar } from "@features/cards/CardAvatar.tsx";
import { CardFace } from "@features/cards/CardFace.tsx";
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
import { ActionButton, HeaderActions } from "@shared/ui/ActionButton.tsx";
import { CheckIcon, PlusIcon, ProviderIcon } from "@shared/ui/icons.tsx";
import { ArrowRight, Search, X } from "lucide-react";
import {
  type MutableRefObject,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import darkBrandLogo from "../../../assets/brand/sideset-logo-dark.png" with { type: "file" };
import lightBrandLogo from "../../../assets/brand/sideset-logo-light.png" with { type: "file" };

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

  // Axis locking preserves vertical page scrolling while keeping the card swipe forgiving.
  const onCarStart = (event: React.PointerEvent): void => {
    if (!interactive) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let locked: "x" | "y" | null = null;
    moved.current = false;
    const cleanup = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    const move = (pointer: PointerEvent): void => {
      const dx = pointer.clientX - startX;
      const dy = pointer.clientY - startY;
      if (locked === null && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) {
        locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (locked === "y") {
          cleanup();
          setDrag({ x: 0, dragging: false });
        }
      }
      if (locked === "x") {
        if (pointer.cancelable) pointer.preventDefault();
        moved.current = true;
        setDrag({ x: dampDrag(dx), dragging: true });
      }
    };
    const settle = (dx: number): void => {
      if (locked === "x" && Math.abs(dx) > 48) {
        onCarIndex(wrapIndex(carIndex + (dx < 0 ? 1 : -1), n));
      }
      setDrag({ x: 0, dragging: false });
      setTimeout(() => {
        moved.current = false;
      }, 60);
    };
    const up = (pointer: PointerEvent): void => {
      cleanup();
      settle(pointer.clientX - startX);
    };
    const cancel = (): void => {
      cleanup();
      settle(0);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  return (
    <div data-testid="screen-home" className="scr screen wallet-screen">
      <header className="wallet-header">
        <div className="home-brand">
          <div className="home-brand-lockup" role="img" aria-label="Sideset">
            <img className="home-brand-logo home-brand-logo-light" src={lightBrandLogo} alt="" />
            <img className="home-brand-logo home-brand-logo-dark" src={darkBrandLogo} alt="" />
          </div>
          <p className="hdr-sub">{greetingFor(new Date().getHours())}</p>
        </div>
        <HeaderActions>
          <ActionButton
            data-testid="home-search-identities"
            aria-label={searchOpen ? "Close identity search" : "Search identities"}
            aria-expanded={searchOpen}
            iconOnly
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
          </ActionButton>
          <ActionButton data-testid="home-action-new-identity" variant="primary" onClick={onCreate}>
            <PlusIcon size={19} width={2.5} />
            <span>New</span>
          </ActionButton>
        </HeaderActions>
      </header>

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
                    <CardAvatar card={card} style={{ width: 40, height: 40 }} />
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

      <main className="wallet-content">
        <section aria-label="Your identities">
          <div
            data-testid="home-card-carousel"
            className="wallet-carousel"
            onPointerDown={onCarStart}
          >
            <div className="wallet-carousel-stage">
              {cards.map((card, index) => {
                const relative = signedDistance(index, pos, n);
                const isFront = index === front;
                const placement = cardPlacement(relative);
                return (
                  <div
                    data-testid={`home-card-${card.id}`}
                    key={card.id}
                    role="button"
                    tabIndex={placement.opacity === 0 ? -1 : 0}
                    aria-label={`${card.name} identity. ${isFront ? "Open identity" : "Select identity"}`}
                    aria-current={isFront ? "true" : undefined}
                    ref={
                      isFront
                        ? (element) => {
                            frontCardRef.current = element;
                          }
                        : null
                    }
                    onClick={(event) => {
                      if (moved.current) return;
                      if (isFront) onOpenDetail(card.id, event.currentTarget);
                      else onCarIndex(index);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      if (isFront) onOpenDetail(card.id, event.currentTarget);
                      else onCarIndex(index);
                    }}
                    className="wallet-carousel-card"
                    style={{
                      transform: `translateX(calc(-50% + ${placement.x}px)) translateZ(${placement.translateZ}px) rotateY(${placement.rotateY}deg) scale(${placement.scale})`,
                      zIndex: placement.zIndex,
                      opacity: placement.opacity,
                      visibility: isFront && hideFrontCard ? "hidden" : "visible",
                      transition: drag.dragging
                        ? "none"
                        : `transform .6s ${CAR_EASE}, opacity .45s ease`,
                    }}
                  >
                    <CardFace
                      card={card}
                      active={card.id === activeId}
                      dim={placement.dim}
                      dimTransition={drag.dragging ? "none" : `opacity .6s ${CAR_EASE}`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="wallet-card-hint">Tap card to view and share</p>
          </div>

          <div className="wallet-identity-picker" role="group" aria-label="Choose an identity">
            {cards.map((card, index) => (
              <button
                type="button"
                key={card.id}
                data-testid={`home-card-indicator-${card.id}`}
                aria-label={`Select ${card.name} identity`}
                aria-pressed={index === front}
                className="wallet-identity-chip press"
                onClick={() => onCarIndex(index)}
              >
                <CardAvatar card={card} style={{ width: 30, height: 30 }} />
                <span>{card.name}</span>
                {index === front && <CheckIcon size={13} stroke="currentColor" />}
              </button>
            ))}
          </div>
        </section>

        <section data-testid="home-connected-accounts" className="wallet-section">
          <div className="wallet-section-heading">
            <div>
              <h2>Connected accounts</h2>
              <p>Profiles visible on {active.name}</p>
            </div>
            <span>{active.proofs?.length ?? 0}</span>
          </div>
          <div className="wallet-account-list">
            {(active.proofs ?? []).map((proof) => {
              const meta = PROVIDER_META[proof.provider];
              return (
                <button
                  type="button"
                  key={proof.provider}
                  data-testid={`home-account-${proof.provider}`}
                  className="wallet-account-row press"
                  onClick={() => onAccountTap(proof)}
                >
                  <span className="wallet-provider-icon" style={{ background: meta.bg }}>
                    <ProviderIcon provider={proof.provider} />
                  </span>
                  <span className="wallet-account-copy">
                    <strong>{meta.name}</strong>
                    <small>{proof.username}</small>
                  </span>
                  <span className="wallet-verified">
                    <CheckIcon size={12} stroke="currentColor" /> Connected
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              data-testid="home-connect-account"
              className="wallet-account-row wallet-account-add press"
              onClick={onConnectAccount}
            >
              <span className="wallet-provider-icon">
                <PlusIcon size={19} />
              </span>
              <span className="wallet-account-copy">
                <strong>Connect account</strong>
                <small>Strengthen this identity</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        </section>

        <section data-testid="home-recent-activity" className="wallet-section wallet-recent">
          <div className="wallet-section-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Your latest wallet changes</p>
            </div>
            <button type="button" data-testid="home-see-all-activity" onClick={onSeeActivity}>
              See all
            </button>
          </div>
          <div className="panel">
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => <ActivityRow key={item.id} item={item} />)
            ) : (
              <div className="row-sub wallet-empty-activity">
                Your latest changes will appear here.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
