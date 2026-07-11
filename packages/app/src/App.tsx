import {
  addProof,
  type Card,
  type Contact,
  createCard,
  PROVIDER_META,
  type ProviderId,
  removeProof,
  SEED_CARDS,
  SEED_CONTACTS,
  updateCard,
} from "@keychain/core";
import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { BottomNav, type NavKey } from "./components/BottomNav.tsx";
import { FlipOverlay } from "./components/FlipOverlay.tsx";
import { Sheet } from "./components/Sheet.tsx";
import { FALLBACK_CARD_RECT, FALLBACK_HERO_RECT, type Flip, type Rect } from "./flip.ts";
import { Activity } from "./screens/Activity.tsx";
import { CardDetail } from "./screens/CardDetail.tsx";
import { ContactDetail } from "./screens/ContactDetail.tsx";
import { Contacts } from "./screens/Contacts.tsx";
import { Home } from "./screens/Home.tsx";
import { Settings } from "./screens/Settings.tsx";
import { BackupSheet } from "./sheets/BackupSheet.tsx";
import { CreateSheet } from "./sheets/CreateSheet.tsx";
import { EditSheet } from "./sheets/EditSheet.tsx";
import { ProofSheet } from "./sheets/ProofSheet.tsx";
import { ShareSheet } from "./sheets/ShareSheet.tsx";

export type Screen = "home" | "contacts" | "activity" | "settings" | "detail" | "contactDetail";
export type SheetKind = "share" | "create" | "proof" | "edit" | "backup";

const first = <T,>(xs: readonly T[]): T => {
  const x = xs[0];
  if (x === undefined) throw new Error("Expected a non-empty list");
  return x;
};

export const App = (): ReactElement => {
  const [cards, setCards] = useState<readonly Card[]>(SEED_CARDS);
  const contacts: readonly Contact[] = SEED_CONTACTS;
  const [activeId, setActiveId] = useState(first(SEED_CARDS).id);
  const [screen, setScreen] = useState<Screen>("home");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [carIndex, setCarIndex] = useState(0);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flip, setFlip] = useState<Flip | null>(null);

  const cardById = useCallback(
    (id: string | null): Card => cards.find((c) => c.id === id) ?? first(cards),
    [cards],
  );
  const contactById = (id: string | null): Contact =>
    contacts.find((c) => c.id === id) ?? first(contacts);
  const active = cardById(activeId);
  const detail = cardById(detailId);
  const contact = contactById(contactId);

  // ---- toast ----
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  // ---- shared-element flip morph ----
  const frameRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const contactHeroRef = useRef<HTMLDivElement | null>(null);
  const frontCardRef = useRef<HTMLDivElement | null>(null);
  const contactCardEls = useRef<Record<string, HTMLDivElement>>({});
  const savedContactScroll = useRef(0);
  const flipTimers = useRef<{
    raf?: number;
    reveal?: ReturnType<typeof setTimeout>;
    end?: ReturnType<typeof setTimeout>;
  }>({});

  const clearFlipTimers = useCallback(() => {
    const t = flipTimers.current;
    if (t.raf !== undefined) cancelAnimationFrame(t.raf);
    clearTimeout(t.reveal);
    clearTimeout(t.end);
    flipTimers.current = {};
  }, []);
  useEffect(
    () => () => {
      clearFlipTimers();
      clearTimeout(toastTimer.current);
    },
    [clearFlipTimers],
  );

  const relRect = useCallback((el: HTMLElement): Rect | null => {
    const frame = frameRef.current;
    if (!frame) return null;
    const f = frame.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { top: r.top - f.top, left: r.left - f.left, w: r.width, h: r.height };
  }, []);

  const startFlip = (
    id: string,
    kind: Flip["kind"],
    dir: Flip["dir"],
    from: HTMLElement | null,
    fallback: Rect,
  ): void => {
    clearFlipTimers();
    const rect = (from && relRect(from)) ?? fallback;
    setFlip({ id, kind, dir, rect, target: null, phase: "start" });
  };

  const openDetailFlip = (id: string, el: HTMLElement | null): void => {
    setScreen("detail");
    setDetailId(id);
    startFlip(id, "card", "fwd", el, FALLBACK_CARD_RECT);
  };
  const backFromDetail = (): void => {
    if (!detailId) return;
    setScreen("home");
    startFlip(detailId, "card", "rev", heroRef.current, FALLBACK_HERO_RECT);
  };
  const openContactFlip = (id: string, el: HTMLElement | null): void => {
    setScreen("contactDetail");
    setContactId(id);
    startFlip(id, "contact", "fwd", el, { top: 150, left: 30, w: 352, h: 160 });
  };
  const backFromContact = (): void => {
    if (!contactId) return;
    setScreen("contacts");
    startFlip(contactId, "contact", "rev", contactHeroRef.current, {
      top: 0,
      left: 0,
      w: 412,
      h: 300,
    });
  };

  // Once the destination screen has mounted, measure the morph target and run the
  // transition. Reveal the real hero imperatively — a re-render mid-morph stutters it.
  useEffect(() => {
    if (flip?.phase !== "start" || flip.target) return;
    const targetEl =
      flip.dir === "fwd"
        ? flip.kind === "contact"
          ? contactHeroRef.current
          : heroRef.current
        : flip.kind === "contact"
          ? (contactCardEls.current[flip.id] ?? null)
          : frontCardRef.current;
    if (!targetEl) return;
    const target = relRect(targetEl);
    if (!target) return;
    flipTimers.current.raf = requestAnimationFrame(() => {
      flipTimers.current.raf = requestAnimationFrame(() => {
        setFlip((f) => (f && f.phase === "start" ? { ...f, target, phase: "end" } : f));
      });
    });
    if (flip.dir === "fwd") {
      const kind = flip.kind;
      flipTimers.current.reveal = setTimeout(() => {
        const hero = kind === "contact" ? contactHeroRef.current : heroRef.current;
        if (hero) {
          hero.style.transition = "opacity .18s";
          hero.style.opacity = "1";
        }
      }, 420);
    }
    flipTimers.current.end = setTimeout(() => setFlip(null), 640);
  }, [flip, relRect]);

  // ---- nav ----
  const go = (key: NavKey): void => {
    clearFlipTimers();
    setFlip(null);
    setSheet(null);
    setScreen(key);
  };
  const navCurrent: NavKey =
    screen === "detail" ? "home" : screen === "contactDetail" ? "contacts" : screen;

  // ---- domain actions ----
  const activate = (card: Card): void => {
    setActiveId(card.id);
    showToast(`${card.name} is now active`);
  };
  const finishCreate = (input: { name: string; avatar: string; color: number }): void => {
    const card = createCard({ id: `c${Date.now()}`, ...input });
    setCards((cs) => [...cs, card]);
    setActiveId(card.id);
    setSheet(null);
    setScreen("home");
    showToast("Card created & activated");
  };
  const finishProof = (provider: ProviderId): void => {
    setCards((cs) => addProof(cs, activeId, provider));
    setSheet(null);
    showToast(`Verified on ${PROVIDER_META[provider].name}`);
  };
  const saveEdit = (patch: { name: string; bio: string; avatar: string }): void => {
    if (detailId) setCards((cs) => updateCard(cs, detailId, patch));
    setSheet(null);
    showToast("Saved");
  };
  const removeDetailProof = (provider: ProviderId): void => {
    setCards((cs) => removeProof(cs, detail.id, provider));
    showToast(`${PROVIDER_META[provider].name} proof removed`);
  };
  const openProofSheet = (): void => setSheet("proof");

  return (
    <div style={{ width: "100%", height: "100vh", minHeight: "100dvh" }}>
      <div className="frame" ref={frameRef}>
        {screen === "home" && (
          <Home
            cards={cards}
            activeId={activeId}
            active={active}
            carIndex={carIndex}
            onCarIndex={setCarIndex}
            interactive={!flip && !sheet}
            frontCardRef={frontCardRef}
            onActivate={activate}
            onOpenDetail={openDetailFlip}
            onAddProof={openProofSheet}
            onCreate={() => setSheet("create")}
            onSeeActivity={() => go("activity")}
            onProofTap={(p) =>
              showToast(`Provably ${p.username} on ${PROVIDER_META[p.provider].name}`)
            }
          />
        )}
        {screen === "contacts" && (
          <Contacts
            contacts={contacts}
            cardEls={contactCardEls}
            savedScroll={savedContactScroll}
            onOpen={openContactFlip}
            onAdd={openProofSheet}
          />
        )}
        {screen === "activity" && <Activity />}
        {screen === "settings" && (
          <Settings
            active={active}
            onOpenActiveCard={() => {
              setScreen("detail");
              setDetailId(activeId);
            }}
            onBackup={() => setSheet("backup")}
            onToast={showToast}
          />
        )}
        {screen === "detail" && (
          <CardDetail
            card={detail}
            isActive={detail.id === activeId}
            heroRef={heroRef}
            heroHidden={flip !== null}
            onBack={backFromDetail}
            onEdit={() => setSheet("edit")}
            onShare={() => setSheet("share")}
            onBackup={() => setSheet("backup")}
            onActivate={() => activate(detail)}
            onRemoveProof={removeDetailProof}
            onAddProof={() => {
              setActiveId(detail.id);
              setSheet("proof");
            }}
          />
        )}
        {screen === "contactDetail" && (
          <ContactDetail
            contact={contact}
            heroRef={contactHeroRef}
            heroHidden={flip !== null}
            onBack={backFromContact}
            onToast={showToast}
          />
        )}

        {sheet === null && <BottomNav current={navCurrent} onGo={go} />}

        {sheet !== null && (
          <Sheet onClose={() => setSheet(null)}>
            {sheet === "share" && (
              <ShareSheet card={detail} onToast={showToast} onClose={() => setSheet(null)} />
            )}
            {sheet === "create" && <CreateSheet onFinish={finishCreate} onToast={showToast} />}
            {sheet === "proof" && <ProofSheet card={active} onFinish={finishProof} />}
            {sheet === "edit" && <EditSheet card={detail} onSave={saveEdit} />}
            {sheet === "backup" && (
              <BackupSheet
                card={detail}
                onToast={showToast}
                onDone={() => {
                  setSheet(null);
                  showToast("Protected ✓");
                }}
              />
            )}
          </Sheet>
        )}

        {flip && (
          <FlipOverlay
            flip={flip}
            subject={flip.kind === "contact" ? contactById(flip.id) : cardById(flip.id)}
          />
        )}

        {toast !== null && (
          <div
            style={{
              position: "absolute",
              bottom: 120,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 90,
              background: "#1B1917",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 24,
              fontSize: 13.5,
              fontWeight: 700,
              boxShadow: "0 10px 30px -8px rgba(0,0,0,.5)",
              animation: "popIn .3s ease",
              whiteSpace: "nowrap",
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};
