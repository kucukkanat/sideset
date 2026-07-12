import {
  type Card,
  type Contact,
  type ContactChanges,
  createCard,
  type IdentityKeyPair,
  PROVIDER_META,
  type Proof,
  type ProviderId,
  removeContacts,
  removeProof,
  updateCard,
  updateContact,
} from "@keychain/core";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { addVerifiedGithubProof } from "./accountVerification.ts";
import { createActivity } from "./activity.ts";
import { createEncryptedBackup, readEncryptedBackup } from "./backup.ts";
import { BottomNav, type NavKey } from "./components/BottomNav.tsx";
import { FlipOverlay } from "./components/FlipOverlay.tsx";
import { Sheet } from "./components/Sheet.tsx";
import { FALLBACK_CARD_RECT, FALLBACK_HERO_RECT, type Flip, type Rect } from "./flip.ts";
import { routeWithoutOverlay } from "./routing.ts";
import { Activity } from "./screens/Activity.tsx";
import { CardDetail } from "./screens/CardDetail.tsx";
import { ContactDetail } from "./screens/ContactDetail.tsx";
import { Contacts } from "./screens/Contacts.tsx";
import { Home } from "./screens/Home.tsx";
import { Settings } from "./screens/Settings.tsx";
import { Tools } from "./screens/Tools.tsx";
import {
  encodeSharedProfile,
  type SharedProfile,
  sharedProfileToContact,
} from "./sharedProfile.ts";
import { copyText, profileShareUrl, shareProfile } from "./sharing.ts";
import { type AddContactResult, AddContactSheet } from "./sheets/AddContactSheet.tsx";
import { AppearanceSheet } from "./sheets/AppearanceSheet.tsx";
import { type BackupSaveResult, BackupSheet } from "./sheets/BackupSheet.tsx";
import { ConnectAccountSheet } from "./sheets/ConnectAccountSheet.tsx";
import { CreateSheet } from "./sheets/CreateSheet.tsx";
import { type EditContactResult, EditContactSheet } from "./sheets/EditContactSheet.tsx";
import { EditSheet } from "./sheets/EditSheet.tsx";
import { HelpSheet } from "./sheets/HelpSheet.tsx";
import { ResetSheet } from "./sheets/ResetSheet.tsx";
import { type RestoreResult, RestoreSheet } from "./sheets/RestoreSheet.tsx";
import { ShareSheet } from "./sheets/ShareSheet.tsx";
import {
  createInitialWalletState,
  decodeWalletSnapshot,
  loadWalletState,
  MAX_CARDS,
  MAX_CONTACTS,
  saveWalletState,
  type Theme,
  type WalletState,
  walletSnapshot,
} from "./storage.ts";
import { useHashRouter } from "./useHashRouter.ts";

const withActivity = (
  state: WalletState,
  event: ReturnType<typeof createActivity>,
): WalletState => ({ ...state, activity: [event, ...state.activity].slice(0, 100) });

const shareUrlFor = (subject: Card | Contact): string =>
  profileShareUrl(window.location.href, encodeSharedProfile(subject));

const backupFilename = (): string =>
  `keychain-backup-${new Date().toISOString().slice(0, 10)}.json`;

export const App = (): ReactElement => {
  const { route, push, replace, back, closeOverlay } = useHashRouter();
  const [loaded] = useState(loadWalletState);
  const [wallet, setWallet] = useState<WalletState>(loaded.state);
  const [firstCardCreationOpen, setFirstCardCreationOpen] = useState(
    loaded.state.cards.length === 0,
  );
  const [contactQuery, setContactQuery] = useState("");
  const [contactManaging, setContactManaging] = useState(false);
  const [contactRemovalOpen, setContactRemovalOpen] = useState(false);
  const [persistenceEnabled, setPersistenceEnabled] = useState(
    loaded.ok || loaded.reason !== "unsupported",
  );
  const { cards, contacts, activeId, activity, theme } = wallet;
  const active = cards.find((card) => card.id === activeId);
  const detail = route.page === "card" ? cards.find((card) => card.id === route.cardId) : undefined;
  const connectCard =
    route.page === "card"
      ? detail
      : route.page === "wallet"
        ? cards.find((card) => card.id === (route.cardId ?? activeId))
        : undefined;
  const contact =
    route.page === "person" ? contacts.find((person) => person.id === route.contactId) : undefined;
  const selectedCardId = route.page === "wallet" ? (route.cardId ?? activeId) : activeId;
  const selectedIndex = Math.max(
    0,
    cards.findIndex((card) => card.id === selectedCardId),
  );
  const recentActivity = [...activity]
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, 3);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((message: string): void => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  const storageWarningShown = useRef(false);
  useEffect(() => {
    if (!loaded.ok && !storageWarningShown.current) {
      storageWarningShown.current = true;
      showToast(
        loaded.reason === "invalid"
          ? "Saved data was damaged, so the preview was reset"
          : loaded.reason === "unsupported"
            ? "Saved data needs a newer app; changes won’t be saved"
            : "Changes can’t be saved on this device",
      );
    }
  }, [loaded, showToast]);

  useEffect(() => {
    // Never destroy state written by a newer schema when an older app is opened.
    if (!persistenceEnabled) return;
    const result = saveWalletState(wallet);
    if (!result.ok && !storageWarningShown.current) {
      storageWarningShown.current = true;
      showToast("Changes can’t be saved on this device");
    }
  }, [persistenceEnabled, showToast, wallet]);

  useEffect(() => {
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const applyTheme = (): void => {
      const resolved = theme === "system" ? (media?.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#171513" : "#f4efe8");
    };
    applyTheme();
    if (theme === "system") media?.addEventListener("change", applyTheme);
    return () => media?.removeEventListener("change", applyTheme);
  }, [theme]);

  // Route parsing is syntactic; record existence is validated against local state here.
  useEffect(() => {
    if (route.page === "card" && detail === undefined) {
      replace({ page: "wallet" });
      return;
    }
    if (route.page === "person" && contact === undefined) {
      replace({ page: "people" });
      return;
    }
    if (
      route.page === "wallet" &&
      route.cardId !== undefined &&
      !cards.some((card) => card.id === route.cardId)
    ) {
      replace(
        route.sheet === "create"
          ? { page: "wallet", sheet: "create" }
          : route.sheet === "connect"
            ? { page: "wallet", sheet: "connect" }
            : { page: "wallet" },
      );
    }
  }, [cards, contact, detail, replace, route]);

  // Shared-element flip morph state remains ephemeral; the destination itself is URL state.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const contactHeroRef = useRef<HTMLDivElement | null>(null);
  const frontCardRef = useRef<HTMLDivElement | null>(null);
  const contactCardEls = useRef<Record<string, HTMLButtonElement>>({});
  const savedContactScroll = useRef(0);
  const detailOrigin = useRef<"wallet" | "settings" | null>(null);
  const contactOrigin = useRef<"people" | null>(null);
  const [flip, setFlip] = useState<Flip | null>(null);
  const flipTimers = useRef<{
    raf?: number;
    reveal?: ReturnType<typeof setTimeout>;
    end?: ReturnType<typeof setTimeout>;
  }>({});

  const clearFlipTimers = useCallback((): void => {
    const timers = flipTimers.current;
    if (timers.raf !== undefined) cancelAnimationFrame(timers.raf);
    clearTimeout(timers.reveal);
    clearTimeout(timers.end);
    flipTimers.current = {};
  }, []);

  useEffect(
    () => () => {
      clearFlipTimers();
      clearTimeout(toastTimer.current);
    },
    [clearFlipTimers],
  );

  const relativeRect = useCallback((element: HTMLElement): Rect | null => {
    const frame = frameRef.current;
    if (frame === null) return null;
    const frameRect = frame.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top - frameRect.top,
      left: rect.left - frameRect.left,
      w: rect.width,
      h: rect.height,
    };
  }, []);

  const startFlip = (
    id: string,
    kind: Flip["kind"],
    direction: Flip["dir"],
    from: HTMLElement | null,
    fallback: Rect,
  ): void => {
    clearFlipTimers();
    flipTimers.current.end = setTimeout(() => {
      setFlip((current) => (current?.id === id && current.kind === kind ? null : current));
    }, 5_000);
    setFlip({
      id,
      kind,
      dir: direction,
      rect: (from && relativeRect(from)) ?? fallback,
      target: null,
      phase: "start",
    });
  };

  const openDetailFlip = (id: string, element: HTMLElement | null): void => {
    detailOrigin.current = "wallet";
    push({ page: "card", cardId: id });
    startFlip(id, "card", "fwd", element, FALLBACK_CARD_RECT);
  };

  const backFromDetail = (): void => {
    if (detail === undefined) return;
    const animate = detailOrigin.current === "wallet";
    if (animate) startFlip(detail.id, "card", "rev", heroRef.current, FALLBACK_HERO_RECT);
    back(animate ? { page: "wallet", cardId: detail.id } : { page: "wallet" });
    detailOrigin.current = null;
  };

  const openContactFlip = (id: string, element: HTMLElement | null): void => {
    contactOrigin.current = "people";
    push({ page: "person", contactId: id });
    startFlip(id, "contact", "fwd", element, { top: 150, left: 30, w: 352, h: 160 });
  };

  const backFromContact = (): void => {
    if (contact === undefined) return;
    const animate = contactOrigin.current === "people";
    if (animate) {
      startFlip(contact.id, "contact", "rev", contactHeroRef.current, {
        top: 0,
        left: 0,
        w: 412,
        h: 300,
      });
    }
    back({ page: "people" });
    contactOrigin.current = null;
  };

  useLayoutEffect(() => {
    if (flip?.phase !== "start" || flip.target !== null) return;
    const destinationPage =
      flip.dir === "fwd"
        ? flip.kind === "card"
          ? "card"
          : "person"
        : flip.kind === "card"
          ? "wallet"
          : "people";
    if (route.page !== destinationPage) return;
    const activeFlip = flip;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      clearFlipTimers();
      setFlip((current) => (current === activeFlip ? null : current));
      return;
    }
    const targetElement =
      flip.dir === "fwd"
        ? flip.kind === "contact"
          ? contactHeroRef.current
          : heroRef.current
        : flip.kind === "contact"
          ? (contactCardEls.current[flip.id] ?? null)
          : frontCardRef.current;
    if (targetElement === null) return;
    const target = relativeRect(targetElement);
    if (target === null) return;
    flipTimers.current.raf = requestAnimationFrame(() => {
      flipTimers.current.raf = requestAnimationFrame(() => {
        setFlip((current) =>
          current?.phase === "start" ? { ...current, target, phase: "end" } : current,
        );
        clearTimeout(flipTimers.current.end);
        flipTimers.current.end = setTimeout(() => {
          setFlip((current) =>
            current?.id === activeFlip.id && current.kind === activeFlip.kind ? null : current,
          );
        }, 700);
        if (activeFlip.dir === "fwd") {
          flipTimers.current.reveal = setTimeout(() => {
            const hero = activeFlip.kind === "contact" ? contactHeroRef.current : heroRef.current;
            if (hero !== null) {
              hero.style.transition = "opacity .18s";
              hero.style.opacity = "1";
            }
          }, 420);
        }
      });
    });
  }, [clearFlipTimers, flip, relativeRect, route.page]);

  const go = (key: NavKey): void => {
    clearFlipTimers();
    setFlip(null);
    detailOrigin.current = null;
    contactOrigin.current = null;
    switch (key) {
      case "home":
        push({ page: "wallet" });
        break;
      case "contacts":
        push({ page: "people" });
        break;
      case "tools":
        push({ page: "tools", operation: "encrypt" });
        break;
      case "settings":
        push({ page: "settings" });
        break;
    }
  };

  const navCurrent: NavKey =
    route.page === "people" || route.page === "person"
      ? "contacts"
      : route.page === "tools"
        ? "tools"
        : route.page === "settings"
          ? "settings"
          : "home";

  const activate = (card: Card): void => {
    if (card.id === activeId) return;
    const previous = active?.name ?? card.name;
    setWallet((state) =>
      withActivity(
        { ...state, activeId: card.id },
        createActivity(
          { kind: "emoji", emoji: "🔄", bg: "#EDE7FB" },
          `Switched to ${card.name}`,
          `from ${previous}`,
        ),
      ),
    );
    if (route.page === "wallet") replace({ page: "wallet", cardId: card.id });
    showToast(`${card.name} is now active`);
  };

  const finishCreate = (input: {
    name: string;
    username: string;
    email: string;
    avatar: string;
    color: number;
    identity: IdentityKeyPair;
  }): boolean => {
    if (cards.length >= MAX_CARDS) {
      showToast("This preview can hold up to 100 cards");
      return false;
    }
    const card = createCard({ id: crypto.randomUUID(), ...input });
    setWallet((state) =>
      withActivity(
        { ...state, cards: [...state.cards, card], activeId: card.id },
        createActivity(
          {
            kind: "emoji",
            emoji: card.avatar.startsWith("data:image/") ? "🙂" : card.avatar || "🙂",
            bg: "#E9F7EC",
          },
          `Created ${card.name} card`,
          "A separate profile",
        ),
      ),
    );
    showToast("Card created and activated");
    return true;
  };

  const saveEdit = (patch: {
    name: string;
    username: string;
    email: string;
    bio: string;
    avatar: string;
  }): void => {
    if (detail === undefined) return;
    const name = patch.name.trim();
    if (name.length === 0) {
      showToast("Give your card a name");
      return;
    }
    setWallet((state) =>
      withActivity(
        { ...state, cards: updateCard(state.cards, detail.id, { ...patch, name }) },
        createActivity(
          {
            kind: "emoji",
            emoji: patch.avatar.startsWith("data:image/") ? "🙂" : patch.avatar || "🙂",
            bg: "#FCEDE7",
          },
          `Updated ${name}`,
          "Card details changed",
        ),
      ),
    );
    closeOverlay();
    showToast("Changes saved");
  };

  const disconnectAccount = (provider: ProviderId): void => {
    if (detail === undefined) return;
    setWallet((state) =>
      withActivity(
        { ...state, cards: removeProof(state.cards, detail.id, provider) },
        createActivity(
          { kind: "provider", provider },
          `Disconnected ${PROVIDER_META[provider].name}`,
          detail.name,
        ),
      ),
    );
    showToast(`${PROVIDER_META[provider].name} disconnected`);
  };

  const connectAccount = (cardId: string): void => {
    if (route.page === "card" && route.cardId === cardId) {
      push({ page: "card", cardId, sheet: "connect" });
      return;
    }
    push({ page: "wallet", cardId, sheet: "connect" });
  };

  const saveIdentity = (identity: IdentityKeyPair): void => {
    if (connectCard === undefined) return;
    setWallet((state) => ({
      ...state,
      cards: state.cards.map((card) =>
        card.id === connectCard.id && card.identity === undefined ? { ...card, identity } : card,
      ),
    }));
  };

  const finishConnectAccount = (account: {
    readonly username: string;
    readonly verificationCode: string;
    readonly identity: IdentityKeyPair;
  }): void => {
    if (connectCard === undefined) return;
    const cardId = connectCard.id;
    setWallet((state) =>
      withActivity(
        {
          ...state,
          cards: addVerifiedGithubProof(
            state.cards,
            cardId,
            account.username,
            account.verificationCode,
            account.identity,
          ),
        },
        createActivity(
          { kind: "provider", provider: "github" },
          `Connected ${account.username}`,
          `${connectCard.name} · GitHub`,
        ),
      ),
    );
    closeOverlay();
    showToast("GitHub account connected");
  };

  const addContact = (
    profile: SharedProfile,
    verifiedProofs: readonly Proof[],
  ): AddContactResult => {
    if (contacts.length >= MAX_CONTACTS) {
      return { ok: false, message: "This preview can hold up to 500 contacts" };
    }
    const next = sharedProfileToContact(profile, verifiedProofs);
    if (
      contacts.some(
        (existing) =>
          existing.id === next.id ||
          (next.npub.length > 0 && existing.npub === next.npub) ||
          existing.handle.toLowerCase() === next.handle.toLowerCase(),
      )
    ) {
      return { ok: false, message: "This contact is already in your list" };
    }
    setWallet((state) =>
      withActivity(
        { ...state, contacts: [...state.contacts, next] },
        createActivity(
          { kind: "emoji", emoji: next.avatar, bg: "#E9F7EC" },
          `Added ${next.name}`,
          "Saved to contacts",
        ),
      ),
    );
    replace({ page: "person", contactId: next.id });
    showToast(`${next.name} added`);
    return { ok: true };
  };

  const saveContact = (changes: ContactChanges): EditContactResult => {
    if (contact === undefined) return { ok: false, message: "This contact is no longer available" };
    if (
      contacts.some(
        (person) =>
          person.id !== contact.id && person.handle.toLowerCase() === changes.handle.toLowerCase(),
      )
    ) {
      return { ok: false, message: "Another contact already uses this handle" };
    }
    setWallet((state) =>
      withActivity(
        { ...state, contacts: updateContact(state.contacts, contact.id, changes) },
        createActivity(
          { kind: "emoji", emoji: changes.avatar, bg: "#EDE7FB" },
          `Updated ${changes.name}`,
          "Contact details changed",
        ),
      ),
    );
    closeOverlay();
    showToast("Contact updated");
    return { ok: true };
  };

  const removeContactIds = (contactIds: readonly string[]): void => {
    const removing = contacts.filter((person) => contactIds.includes(person.id));
    if (removing.length === 0) return;
    const firstRemoved = removing[0];
    if (firstRemoved === undefined) return;
    setWallet((state) =>
      withActivity(
        { ...state, contacts: removeContacts(state.contacts, contactIds) },
        createActivity(
          {
            kind: "emoji",
            emoji: removing.length === 1 ? firstRemoved.avatar : "🗑️",
            bg: "#FDECE7",
          },
          removing.length === 1
            ? `Removed ${firstRemoved.name}`
            : `Removed ${removing.length} contacts`,
          "From contacts",
        ),
      ),
    );
    if (route.page === "person" && contactIds.includes(route.contactId)) {
      replace({ page: "people" });
    }
    showToast(
      removing.length === 1
        ? `${firstRemoved.name} removed`
        : `${removing.length} contacts removed`,
    );
  };

  const copyProfileLink = async (url: string): Promise<void> => {
    const result = await copyText(url);
    showToast(result.ok ? "Profile link copied" : "Clipboard access isn’t available");
  };

  const copyPublicKey = async (publicKey: string): Promise<void> => {
    const result = await copyText(publicKey);
    showToast(result.ok ? "Public key copied" : "Clipboard access isn’t available");
  };

  const copyPrivateKey = async (privateKey: string): Promise<void> => {
    const result = await copyText(privateKey);
    showToast(
      result.ok ? "Private key copied — keep it secret" : "Clipboard access isn’t available",
    );
  };

  const shareContact = async (person: Contact, url: string): Promise<void> => {
    const result = await shareProfile({
      title: `${person.name} profile`,
      text: `Add ${person.name} to your contacts`,
      url,
    });
    if (!result.ok) {
      if (result.reason !== "cancelled") showToast("Sharing isn’t available right now");
      return;
    }
    showToast(result.method === "clipboard" ? "Profile link copied" : "Profile shared");
  };

  const saveBackup = async (password: string): Promise<BackupSaveResult> => {
    try {
      const contents = await createEncryptedBackup(walletSnapshot(wallet), password);
      setWallet((state) =>
        withActivity(
          state,
          createActivity(
            { kind: "emoji", emoji: "🛡️", bg: "#E9F7EC" },
            "Prepared an encrypted backup",
            "Ready to download",
          ),
        ),
      );
      return { ok: true, contents, filename: backupFilename() };
    } catch {
      return { ok: false, message: "The backup could not be created" };
    }
  };

  const restoreBackup = async (contents: string, password: string): Promise<RestoreResult> => {
    const decrypted = await readEncryptedBackup(contents, password);
    if (!decrypted.ok) {
      return {
        ok: false,
        message:
          decrypted.reason === "wrong-password-or-damaged"
            ? "Wrong password, or the backup is damaged"
            : "This isn’t a supported Keychain backup",
      };
    }
    const decoded = decodeWalletSnapshot(decrypted.value);
    if (!decoded.ok) return { ok: false, message: "This backup contains invalid data" };
    const restored = withActivity(
      decoded.state,
      createActivity(
        { kind: "emoji", emoji: "📥", bg: "#FFF6DB" },
        "Restored a local backup",
        "Cards and contacts restored",
      ),
    );
    if (!saveWalletState(restored).ok) {
      return { ok: false, message: "The restored data couldn’t be saved on this device" };
    }
    setPersistenceEnabled(true);
    setWallet(restored);
    return { ok: true };
  };

  const changeTheme = (nextTheme: Theme): void => {
    setWallet((state) => ({ ...state, theme: nextTheme }));
  };

  const resetApplication = (): void => {
    const reset = createInitialWalletState();
    if (!saveWalletState(reset).ok) {
      showToast("The application couldn’t be reset on this device");
      return;
    }
    setPersistenceEnabled(true);
    setWallet(reset);
    setFirstCardCreationOpen(true);
    setContactQuery("");
    setContactManaging(false);
    setContactRemovalOpen(false);
    replace({ page: "settings" });
    showToast("Application reset");
  };

  const overlayOpen =
    routeWithoutOverlay(route) !== null &&
    (route.page !== "card" || detail !== undefined) &&
    (route.page !== "person" || contact !== undefined);
  const flipSubject =
    flip?.kind === "contact"
      ? contacts.find((person) => person.id === flip.id)
      : flip
        ? cards.find((card) => card.id === flip.id)
        : undefined;
  const contactUrl = contact === undefined ? "" : shareUrlFor(contact);
  const sheetLabel =
    route.page === "person"
      ? "Edit contact"
      : route.page === "people"
        ? "Add contact"
        : route.page === "settings"
          ? "Settings"
          : route.page === "card"
            ? `${route.sheet ?? "Card"} ${detail?.name ?? "card"}`
            : "Keychain dialog";

  return (
    <div data-testid="app-root" style={{ width: "100%", height: "100vh", minHeight: "100dvh" }}>
      <div data-testid="app-frame" className="frame" ref={frameRef}>
        {firstCardCreationOpen && (
          <div style={{ padding: 24, overflow: "auto", height: "100%" }}>
            <CreateSheet
              onFinish={finishCreate}
              onDone={() => {
                setFirstCardCreationOpen(false);
                replace({ page: "wallet", cardId: wallet.activeId });
              }}
              onToast={showToast}
            />
          </div>
        )}
        {!firstCardCreationOpen && route.page === "wallet" && active !== undefined && (
          <Home
            cards={cards}
            activeId={activeId}
            active={active}
            carIndex={selectedIndex}
            onCarIndex={(index) => {
              const selected = cards[index];
              if (selected !== undefined) activate(selected);
            }}
            interactive={flip === null && !overlayOpen}
            hideFrontCard={flip?.dir === "rev" && flip.kind === "card"}
            frontCardRef={frontCardRef}
            onOpenDetail={openDetailFlip}
            onImport={() => push({ page: "people", sheet: "add" })}
            onCreate={() =>
              push({
                page: "wallet",
                cardId: cards[selectedIndex]?.id ?? activeId,
                sheet: "create",
              })
            }
            onConnectAccount={() => connectAccount(active.id)}
            onSeeActivity={() => push({ page: "activity" })}
            onAccountTap={(account) =>
              showToast(
                `${account.username} is connected via ${PROVIDER_META[account.provider].name}`,
              )
            }
            recentActivity={recentActivity}
          />
        )}
        {route.page === "people" && (
          <Contacts
            contacts={contacts}
            cardEls={contactCardEls}
            savedScroll={savedContactScroll}
            query={contactQuery}
            onQueryChange={setContactQuery}
            onManagingChange={setContactManaging}
            onOpen={openContactFlip}
            onImport={() => push({ page: "people", sheet: "add" })}
            onRemove={removeContactIds}
          />
        )}
        {route.page === "activity" && <Activity items={activity} />}
        {route.page === "tools" && active !== undefined && (
          <Tools
            active={active}
            cards={cards}
            contacts={contacts}
            operation={route.operation}
            onOperation={(operation) => push({ page: "tools", operation })}
            onToast={showToast}
          />
        )}
        {route.page === "settings" && active !== undefined && (
          <Settings
            active={active}
            theme={theme}
            onOpenActiveCard={() => {
              detailOrigin.current = "settings";
              push({ page: "card", cardId: activeId });
            }}
            onAppearance={() => push({ page: "settings", sheet: "appearance" })}
            onBackup={() => push({ page: "settings", sheet: "backup" })}
            onRestore={() => push({ page: "settings", sheet: "restore" })}
            onHelp={() => push({ page: "settings", sheet: "help" })}
            onReset={() => push({ page: "settings", sheet: "reset" })}
            onActivity={() => push({ page: "activity" })}
          />
        )}
        {route.page === "card" && detail !== undefined && (
          <CardDetail
            card={detail}
            isActive={detail.id === activeId}
            heroRef={heroRef}
            heroHidden={flip !== null}
            onBack={backFromDetail}
            onEdit={() => push({ page: "card", cardId: detail.id, sheet: "edit" })}
            onShare={() => push({ page: "card", cardId: detail.id, sheet: "share" })}
            onBackup={() => push({ page: "card", cardId: detail.id, sheet: "backup" })}
            onActivate={() => activate(detail)}
            onCopyPublicKey={(publicKey) => void copyPublicKey(publicKey)}
            onCopyPrivateKey={(privateKey) => void copyPrivateKey(privateKey)}
            onDisconnectAccount={disconnectAccount}
            onConnectAccount={() => connectAccount(detail.id)}
          />
        )}
        {route.page === "person" && contact !== undefined && (
          <ContactDetail
            contact={contact}
            profileLink={contactUrl}
            heroRef={contactHeroRef}
            heroHidden={flip !== null}
            onBack={backFromContact}
            onEdit={() => push({ page: "person", contactId: contact.id, sheet: "edit" })}
            onRemove={() => removeContactIds([contact.id])}
            onCopyProfileLink={() => void copyProfileLink(contactUrl)}
            onCopyPublicKey={() => void copyPublicKey(contact.npub)}
            onShare={() => void shareContact(contact, contactUrl)}
            onRemovalDialogChange={setContactRemovalOpen}
          />
        )}

        {!firstCardCreationOpen &&
          active !== undefined &&
          !overlayOpen &&
          !contactManaging &&
          !contactRemovalOpen && <BottomNav current={navCurrent} onGo={go} />}

        {overlayOpen && (
          <Sheet
            onClose={closeOverlay}
            label={sheetLabel}
            dismissible={route.page !== "person" || route.sheet !== "edit"}
          >
            {route.page === "wallet" && route.sheet === "create" && (
              <CreateSheet
                onFinish={finishCreate}
                onDone={() => replace({ page: "wallet", cardId: wallet.activeId })}
                onToast={showToast}
              />
            )}
            {((route.page === "wallet" && route.sheet === "connect") ||
              (route.page === "card" && route.sheet === "connect")) &&
              connectCard !== undefined && (
                <ConnectAccountSheet
                  card={connectCard}
                  onIdentityReady={saveIdentity}
                  onVerified={finishConnectAccount}
                />
              )}
            {route.page === "people" && route.sheet === "add" && (
              <AddContactSheet
                key={route.profile ?? "manual"}
                {...(route.profile === undefined ? {} : { encodedProfile: route.profile })}
                baseUrl={window.location.href}
                onAdd={addContact}
              />
            )}
            {route.page === "card" && detail !== undefined && route.sheet === "share" && (
              <ShareSheet card={detail} shareUrl={shareUrlFor(detail)} onToast={showToast} />
            )}
            {route.page === "card" && detail !== undefined && route.sheet === "edit" && (
              <EditSheet card={detail} onSave={saveEdit} onToast={showToast} />
            )}
            {route.page === "person" && contact !== undefined && route.sheet === "edit" && (
              <EditContactSheet contact={contact} onCancel={closeOverlay} onSave={saveContact} />
            )}
            {((route.page === "card" && route.sheet === "backup") ||
              (route.page === "settings" && route.sheet === "backup")) && (
              <BackupSheet
                label="all your cards and contacts"
                onSave={saveBackup}
                onToast={showToast}
                onDone={() => {
                  closeOverlay();
                  showToast("Encrypted backup prepared");
                }}
              />
            )}
            {route.page === "settings" && route.sheet === "restore" && (
              <RestoreSheet
                onRestore={restoreBackup}
                onDone={() => {
                  closeOverlay();
                  showToast("Backup restored");
                }}
              />
            )}
            {route.page === "settings" && route.sheet === "appearance" && (
              <AppearanceSheet theme={theme} onChange={changeTheme} />
            )}
            {route.page === "settings" && route.sheet === "help" && <HelpSheet />}
            {route.page === "settings" && route.sheet === "reset" && (
              <ResetSheet onReset={resetApplication} />
            )}
          </Sheet>
        )}

        {flip !== null && flipSubject !== undefined && (
          <FlipOverlay flip={flip} subject={flipSubject} />
        )}

        {toast !== null && (
          <div
            role="status"
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
              maxWidth: "calc(100% - 32px)",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
};
