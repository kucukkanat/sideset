import { DisabledFeature } from "@app/features/DisabledFeature.tsx";
import { FeatureReadiness } from "@app/features/FeatureReadiness.tsx";
import type { CurrentFeatureId } from "@app/features/preferences.ts";
import {
  dockFeatureById,
  dockOwnerForPath,
  type FeatureId,
  featureById,
  featureOwnerForPath,
} from "@app/features/registry.ts";
import { useFeatureHost } from "@app/features/useFeatureHost.ts";
import { isCurrentFeatureId } from "@app/features/useFeaturePreferences.ts";
import { useToolPreferences } from "@app/features/useToolPreferences.ts";
import { useWalletRouter, WalletRouterProvider } from "@app/router.tsx";
import { formatHashRoute, parseHashRoute, routeWithoutOverlay } from "@app/routing/index.ts";
import {
  createInitialWalletState,
  decodeWalletBackup,
  type FeatureStorageNamespace,
  loadWalletState,
  MAX_CARDS,
  MAX_CONTACTS,
  resetWalletState,
  saveWalletState,
  type Theme,
  type WalletState,
  walletBackup,
  walletPreferenceInitialization,
  walletStorageCapacityForChange,
} from "@app/storage.ts";
import { Activity } from "@features/activity/Activity.tsx";
import { ActivitySummary } from "@features/activity/ActivitySummary.tsx";
import { projectActivityFact } from "@features/activity/journal.ts";
import {
  type BackupSaveResult,
  type BackupSelection,
  BackupSheet,
} from "@features/backup/BackupSheet.tsx";
import {
  BackupTooLargeError,
  createEncryptedBackup,
  readEncryptedBackup,
} from "@features/backup/backup.ts";
import {
  type RestorePreviewResult,
  type RestoreResult,
  RestoreSheet,
} from "@features/backup/RestoreSheet.tsx";
import { CardDetail } from "@features/cards/CardDetail.tsx";
import { ConnectAccountSheet } from "@features/cards/ConnectAccountSheet.tsx";
import { CreateSheet } from "@features/cards/CreateSheet.tsx";
import { EditSheet } from "@features/cards/EditSheet.tsx";
import { FlipOverlay } from "@features/cards/FlipOverlay.tsx";
import { type AddContactResult, AddContactSheet } from "@features/contacts/AddContactSheet.tsx";
import { ContactDetail } from "@features/contacts/ContactDetail.tsx";
import { Contacts } from "@features/contacts/Contacts.tsx";
import { type EditContactResult, EditContactSheet } from "@features/contacts/EditContactSheet.tsx";
import { addVerifiedGithubProof } from "@features/identity/accountVerification.ts";
import { ShareSheet } from "@features/profile-sharing/ShareSheet.tsx";
import {
  encodeSharedProfile,
  type SharedProfile,
  sharedProfileToContact,
} from "@features/profile-sharing/sharedProfile.ts";
import { profileShareUrl } from "@features/profile-sharing/sharing.ts";
import { AppearanceSheet } from "@features/settings/AppearanceSheet.tsx";
import { FeatureLibrary } from "@features/settings/FeatureLibrary.tsx";
import { HelpSheet } from "@features/settings/HelpSheet.tsx";
import { ResetSheet } from "@features/settings/ResetSheet.tsx";
import { Settings } from "@features/settings/Settings.tsx";
import { Home } from "@features/wallet/Home.tsx";
import {
  type Card,
  type Contact,
  type ContactChanges,
  createCard,
  type IdentityKeyPair,
  PROVIDER_META,
  type Proof,
  type ProviderId,
  removeCards,
  removeContacts,
  removeProof,
  updateCard,
  updateContact,
} from "@keychain/core";
import { copyText } from "@shared/lib/clipboard.ts";
import { FALLBACK_CARD_RECT, FALLBACK_HERO_RECT, type Flip, type Rect } from "@shared/lib/flip.ts";
import { nostrPublicKey } from "@shared/lib/nostrKeys.ts";
import { BottomNav, type BottomNavItem } from "@shared/ui/BottomNav.tsx";
import { FeatureBoundary } from "@shared/ui/FeatureBoundary.tsx";
import { Sheet } from "@shared/ui/Sheet.tsx";
import {
  lazy,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ActivityFact, CapabilityResolver } from "../contracts/capabilities.ts";
import type { FeatureRuntimeContext } from "../contracts/feature.ts";
import { isToolOperation, TOOL_FEATURES } from "../contracts/tool-operation.ts";

const LazyTools = lazy(async () => {
  const runtime = await featureById("tools").load();
  return { default: runtime.Tools };
});

const activationCapabilities: CapabilityResolver = {
  required: (id) => {
    throw new Error(`Capability ${id} is not available during feature activation`);
  },
  optional: () => null,
};

const featureRuntimeContext: FeatureRuntimeContext = { capabilities: activationCapabilities };

const shareUrlFor = (subject: Card | Contact): string =>
  profileShareUrl(window.location.href, encodeSharedProfile(subject));

const backupFilename = (): string =>
  `keychain-backup-${new Date().toISOString().slice(0, 10)}.json`;

const WalletApplication = (): ReactElement => {
  const { route, push, replace, back, closeOverlay } = useWalletRouter();
  const [boot] = useState(() => {
    // Classify the original document before load performs the idempotent V1 -> split migration.
    const preferenceInitialization = walletPreferenceInitialization();
    return { preferenceInitialization, loaded: loadWalletState() };
  });
  const { loaded, preferenceInitialization } = boot;
  const [wallet, setWallet] = useState<WalletState>(loaded.state);
  const [unavailableFeatures, setUnavailableFeatures] = useState<
    readonly FeatureStorageNamespace[]
  >(() => (loaded.ok ? (loaded.unavailableFeatures ?? []) : []));
  const [firstCardCreationOpen, setFirstCardCreationOpen] = useState(
    loaded.state.cards.length === 0 &&
      !(route.page === "people" && route.sheet === "add" && route.profile !== undefined),
  );
  const [contactQuery, setContactQuery] = useState("");
  const [contactManaging, setContactManaging] = useState(false);
  const [contactRemovalOpen, setContactRemovalOpen] = useState(false);
  const [identityRemovalOpen, setIdentityRemovalOpen] = useState(false);
  const [persistenceEnabled, setPersistenceEnabled] = useState(loaded.ok);
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

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((message: string): void => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);
  const featureHost = useFeatureHost({
    initialization: preferenceInitialization,
    onMessage: showToast,
    runtimeContext: featureRuntimeContext,
    unavailableFeatures,
  });
  const toolPreferences = useToolPreferences(showToast);
  const featurePreferences = featureHost.preferences;
  const normalizedFeaturePreferences = featurePreferences;
  const peopleEnabled = featureHost.isEnabled("people");
  const activityEnabled = featureHost.isEnabled("activity");
  const toolsEnabled = featureHost.isEnabled("tools");
  const peopleReadiness = featureHost.readiness("people");
  const activityReadiness = featureHost.readiness("activity");
  const toolsReadiness = featureHost.readiness("tools");
  const toolOperationEnabled =
    route.page !== "tools" || toolPreferences.enabled.includes(route.operation);
  const peopleOperational = peopleEnabled && peopleReadiness !== "data-unavailable";
  const activityOperational = activityEnabled && activityReadiness !== "data-unavailable";
  const activityEnabledRef = useRef(activityOperational);
  useLayoutEffect(() => {
    activityEnabledRef.current = activityOperational;
  }, [activityOperational]);
  const withActivity = (
    update: (state: WalletState) => WalletState,
    fact: ActivityFact,
  ): ((state: WalletState) => WalletState) => {
    // React may replay an updater. Capture every observable input at emission so a replay is pure.
    const eventId = activityEnabledRef.current ? crypto.randomUUID() : null;
    const projectionContext = eventId === null ? null : { id: (): string => eventId };
    return (state) => {
      const next = update(state);
      return projectionContext === null
        ? next
        : {
            ...next,
            activity: projectActivityFact(next.activity, fact, projectionContext),
          };
    };
  };
  const recentActivity = [...activity]
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, 3);

  const storageWarningShown = useRef(false);
  useEffect(() => {
    if (storageWarningShown.current) return;
    if (loaded.ok && (loaded.unavailableFeatures?.length ?? 0) > 0) {
      storageWarningShown.current = true;
      showToast("Some feature data couldn’t be opened; the original data was preserved");
      return;
    }
    if (loaded.ok) return;
    storageWarningShown.current = true;
    showToast(
      loaded.reason === "invalid"
        ? "Saved data was damaged, so the preview was reset"
        : loaded.reason === "unsupported"
          ? "Saved data needs a newer app; changes won’t be saved"
          : "Changes can’t be saved on this device",
    );
  }, [loaded, showToast]);

  useEffect(() => {
    // Never destroy state written by a newer schema when an older app is opened.
    if (!persistenceEnabled) return;
    const result = saveWalletState(wallet, localStorage, {
      preserveFeatures: unavailableFeatures,
    });
    if (result.ok) {
      const nextUnavailable = result.unavailableFeatures ?? [];
      setUnavailableFeatures((current) =>
        current.length === nextUnavailable.length &&
        current.every((feature) => nextUnavailable.includes(feature))
          ? current
          : nextUnavailable,
      );
      if (nextUnavailable.length > 0 && !storageWarningShown.current) {
        storageWarningShown.current = true;
        showToast("Some feature data couldn’t be saved; the original data was preserved");
      }
      return;
    }
    if (!storageWarningShown.current) {
      storageWarningShown.current = true;
      showToast("Changes can’t be saved on this device");
    }
  }, [persistenceEnabled, showToast, unavailableFeatures, wallet]);

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

  const openFeature = (id: CurrentFeatureId): void => {
    if (id === "tools") {
      push({ page: "tools", operation: toolPreferences.enabled[0] ?? "encrypt" });
      return;
    }
    const feature = featureById(id);
    const entryPath =
      ("dock" in feature ? feature.dock?.entryPath : undefined) ?? feature.routes[0]?.prefix;
    if (entryPath === undefined) {
      showToast(`${feature.title} does not have a screen`);
      return;
    }
    push(parseHashRoute(`#${entryPath}`));
  };

  const go = (id: FeatureId): void => {
    clearFlipTimers();
    setFlip(null);
    detailOrigin.current = null;
    contactOrigin.current = null;
    push(
      id === "tools"
        ? { page: "tools", operation: toolPreferences.enabled[0] ?? "encrypt" }
        : parseHashRoute(`#${dockFeatureById(id).entryPath}`),
    );
  };

  const canonicalHash = formatHashRoute(route);
  const queryStart = canonicalHash.indexOf("?");
  const currentPath = canonicalHash.slice(1, queryStart < 0 ? canonicalHash.length : queryStart);
  const currentFeatureOwner = featureOwnerForPath(currentPath);
  const currentRouteEnablement =
    currentFeatureOwner !== null && isCurrentFeatureId(currentFeatureOwner)
      ? normalizedFeaturePreferences.enabled.includes(currentFeatureOwner)
      : true;
  const currentRouteReadiness =
    currentFeatureOwner !== null && isCurrentFeatureId(currentFeatureOwner)
      ? featureHost.readiness(currentFeatureOwner)
      : "ready";
  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    frame.dataset.route = currentPath;
    frame.dataset.routeFeatureEnabled = String(currentRouteEnablement);
    frame.dataset.routeFeatureReadiness = currentRouteReadiness;
    const updateRouteHeading = (): boolean => {
      const heading = frame.querySelector<HTMLHeadingElement>("h1");
      if (heading === null) return false;
      document.title = `${heading.textContent ?? "Keychain"} · Keychain`;
      heading.focus({ preventScroll: true });
      return true;
    };
    if (updateRouteHeading()) return;
    const observer = new MutationObserver(() => {
      if (updateRouteHeading()) observer.disconnect();
    });
    observer.observe(frame, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [currentPath, currentRouteEnablement, currentRouteReadiness]);
  const dockItems = normalizedFeaturePreferences.dock.map(({ id }) => {
    const feature = dockFeatureById(id);
    return {
      key: feature.id,
      label: feature.label,
      icon: feature.icon,
      href: `#${feature.entryPath}`,
    } satisfies BottomNavItem<FeatureId>;
  });
  const navCurrent = dockOwnerForPath(currentPath);

  const commitWalletChange = (
    update: (state: WalletState) => WalletState,
  ): { readonly ok: true } | { readonly ok: false; readonly message: string } => {
    const next = update(wallet);
    const capacity = walletStorageCapacityForChange(wallet, next);
    if (!capacity.ok) {
      return {
        ok: false,
        message:
          capacity.namespace === "people"
            ? "This change would exceed local People storage. Remove a large profile image first."
            : capacity.namespace === "activity"
              ? "This change would exceed local Activity storage."
              : capacity.namespace === "aggregate"
                ? "This change would exceed this device’s safe local storage budget."
                : "This change would exceed local wallet storage. Remove a large profile image first.",
      };
    }
    if (persistenceEnabled) {
      const saved = saveWalletState(next, localStorage, {
        preserveFeatures: unavailableFeatures,
      });
      if (!saved.ok) {
        return { ok: false, message: "This change couldn’t be saved on this device." };
      }
      const nextUnavailable = saved.unavailableFeatures ?? [];
      setUnavailableFeatures((current) =>
        current.length === nextUnavailable.length &&
        current.every((feature) => nextUnavailable.includes(feature))
          ? current
          : nextUnavailable,
      );
    }
    setWallet(next);
    return { ok: true };
  };

  const activate = (card: Card): void => {
    if (card.id === activeId) return;
    const previous = active?.name ?? card.name;
    const committed = commitWalletChange(
      withActivity((state) => ({ ...state, activeId: card.id }), {
        kind: "identity.activated",
        name: card.name,
        previousName: previous,
        occurredAt: Date.now(),
      }),
    );
    if (!committed.ok) {
      showToast(committed.message);
      return;
    }
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
    const committed = commitWalletChange(
      withActivity((state) => ({ ...state, cards: [...state.cards, card], activeId: card.id }), {
        kind: "identity.created",
        name: card.name,
        avatar: card.avatar,
        occurredAt: Date.now(),
      }),
    );
    if (!committed.ok) {
      showToast(committed.message);
      return false;
    }
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
    const committed = commitWalletChange(
      withActivity(
        (state) => ({
          ...state,
          cards: updateCard(state.cards, detail.id, { ...patch, name }),
        }),
        {
          kind: "identity.updated",
          name,
          avatar: patch.avatar,
          occurredAt: Date.now(),
        },
      ),
    );
    if (!committed.ok) {
      showToast(committed.message);
      return;
    }
    closeOverlay();
    showToast("Changes saved");
  };

  const disconnectAccount = (provider: ProviderId): void => {
    if (detail === undefined) return;
    const committed = commitWalletChange(
      withActivity(
        (state) => ({ ...state, cards: removeProof(state.cards, detail.id, provider) }),
        {
          kind: "account.disconnected",
          provider,
          identityName: detail.name,
          occurredAt: Date.now(),
        },
      ),
    );
    if (!committed.ok) {
      showToast(committed.message);
      return;
    }
    showToast(`${PROVIDER_META[provider].name} disconnected`);
  };

  const deleteIdentity = (): void => {
    if (detail === undefined) return;
    const deleted = detail;
    const committed = commitWalletChange(
      withActivity(
        (state) => {
          const remaining = removeCards(state.cards, [deleted.id]);
          return {
            ...state,
            cards: remaining,
            activeId: state.activeId === deleted.id ? (remaining[0]?.id ?? "") : state.activeId,
          };
        },
        {
          kind: "identity.deleted",
          name: deleted.name,
          avatar: deleted.avatar,
          occurredAt: Date.now(),
        },
      ),
    );
    if (!committed.ok) {
      showToast(committed.message);
      return;
    }
    clearFlipTimers();
    setFlip(null);
    detailOrigin.current = null;
    setIdentityRemovalOpen(false);
    if (cards.length === 1) setFirstCardCreationOpen(true);
    replace({ page: "wallet" });
    showToast(`${deleted.name} deleted`);
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
    const committed = commitWalletChange((state) => ({
      ...state,
      cards: state.cards.map((card) =>
        card.id === connectCard.id && card.identity === undefined ? { ...card, identity } : card,
      ),
    }));
    if (!committed.ok) showToast(committed.message);
  };

  const finishConnectAccount = (account: {
    readonly username: string;
    readonly verificationCode: string;
    readonly identity: IdentityKeyPair;
  }): void => {
    if (connectCard === undefined) return;
    const cardId = connectCard.id;
    const committed = commitWalletChange(
      withActivity(
        (state) => ({
          ...state,
          cards: addVerifiedGithubProof(
            state.cards,
            cardId,
            account.username,
            account.verificationCode,
            account.identity,
          ),
        }),
        {
          kind: "account.connected",
          provider: "github",
          username: account.username,
          identityName: connectCard.name,
          occurredAt: Date.now(),
        },
      ),
    );
    if (!committed.ok) {
      showToast(committed.message);
      return;
    }
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
          (next.npub.length > 0 && nostrPublicKey(existing.npub) === nostrPublicKey(next.npub)) ||
          existing.handle.toLowerCase() === next.handle.toLowerCase(),
      )
    ) {
      return { ok: false, message: "This contact is already in your list" };
    }
    const committed = commitWalletChange(
      withActivity((state) => ({ ...state, contacts: [...state.contacts, next] }), {
        kind: "person.added",
        name: next.name,
        avatar: next.avatar,
        occurredAt: Date.now(),
      }),
    );
    if (!committed.ok) return committed;
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
    const committed = commitWalletChange(
      withActivity(
        (state) => ({
          ...state,
          contacts: updateContact(state.contacts, contact.id, changes),
        }),
        {
          kind: "person.updated",
          name: changes.name,
          avatar: changes.avatar,
          occurredAt: Date.now(),
        },
      ),
    );
    if (!committed.ok) return committed;
    closeOverlay();
    showToast("Contact updated");
    return { ok: true };
  };

  const removeContactIds = (contactIds: readonly string[]): void => {
    const removing = contacts.filter((person) => contactIds.includes(person.id));
    if (removing.length === 0) return;
    const firstRemoved = removing[0];
    if (firstRemoved === undefined) return;
    const committed = commitWalletChange(
      withActivity(
        (state) => ({ ...state, contacts: removeContacts(state.contacts, contactIds) }),
        {
          kind: "people.removed",
          count: removing.length,
          firstName: firstRemoved.name,
          firstAvatar: firstRemoved.avatar,
          occurredAt: Date.now(),
        },
      ),
    );
    if (!committed.ok) {
      showToast(committed.message);
      return;
    }
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

  const saveBackup = async (
    password: string,
    selection: BackupSelection,
  ): Promise<BackupSaveResult> => {
    if (selection.contacts && unavailableFeatures.includes("people")) {
      return {
        ok: false,
        message: "People data is preserved but unavailable; deselect Contacts to continue",
      };
    }
    if (selection.settings && unavailableFeatures.includes("activity")) {
      return {
        ok: false,
        message: "Activity data is preserved but unavailable; deselect Settings to continue",
      };
    }
    try {
      const contents = await createEncryptedBackup(walletBackup(wallet, selection), password);
      const committed = commitWalletChange(
        withActivity((state) => state, {
          kind: "backup.prepared",
          occurredAt: Date.now(),
        }),
      );
      if (!committed.ok) showToast(committed.message);
      return { ok: true, contents, filename: backupFilename() };
    } catch (error: unknown) {
      return {
        ok: false,
        message:
          error instanceof BackupTooLargeError
            ? "This selection is too large; include fewer items"
            : "The backup could not be created",
      };
    }
  };

  const previewBackup = async (
    contents: string,
    password: string,
  ): Promise<RestorePreviewResult> => {
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
    const decoded = decodeWalletBackup(decrypted.value);
    if (!decoded.ok) return { ok: false, message: "This backup contains invalid data" };
    return {
      ok: true,
      cards: decoded.state.cards.map(({ id, name }) => ({ id, name })),
      settings: decoded.included.settings,
      contacts: decoded.included.contacts,
      contactCount: decoded.state.contacts.length,
    };
  };

  const restoreBackup = async (
    contents: string,
    password: string,
    selection: BackupSelection,
  ): Promise<RestoreResult> => {
    if (selection.contacts && unavailableFeatures.includes("people")) {
      return { ok: false, message: "People data is protected and can’t be replaced" };
    }
    if (selection.settings && unavailableFeatures.includes("activity")) {
      return { ok: false, message: "Activity data is protected and can’t be replaced" };
    }
    const decrypted = await readEncryptedBackup(contents, password);
    if (!decrypted.ok) return { ok: false, message: "The backup could not be opened again" };
    const decoded = decodeWalletBackup(decrypted.value);
    if (!decoded.ok) return { ok: false, message: "This backup contains invalid data" };
    const selectedCards = decoded.state.cards.filter(({ id }) => selection.cardIds.includes(id));
    const importedCards = new Map(selectedCards.map((card) => [card.id, card]));
    const importedContacts = new Map(
      decoded.state.contacts.map((contact) => [contact.id, contact]),
    );
    const cards = [
      ...wallet.cards.map((card) => importedCards.get(card.id) ?? card),
      ...selectedCards.filter((card) => !wallet.cards.some(({ id }) => id === card.id)),
    ];
    const contacts =
      decoded.included.contacts && selection.contacts
        ? [
            ...wallet.contacts.map((contact) => importedContacts.get(contact.id) ?? contact),
            ...decoded.state.contacts.filter(
              (contact) => !wallet.contacts.some(({ id }) => id === contact.id),
            ),
          ]
        : wallet.contacts;
    const restored = withActivity(
      () => ({
        ...wallet,
        cards,
        contacts,
        activeId: wallet.activeId || cards[0]?.id || "",
        ...(decoded.included.settings && selection.settings
          ? { theme: decoded.state.theme, activity: decoded.state.activity }
          : {}),
      }),
      { kind: "backup.restored", occurredAt: Date.now() },
    )(wallet);
    if (!saveWalletState(restored, localStorage, { preserveFeatures: unavailableFeatures }).ok) {
      return { ok: false, message: "The restored data couldn’t be saved on this device" };
    }
    setPersistenceEnabled(true);
    setWallet(restored);
    return { ok: true };
  };

  const changeTheme = (nextTheme: Theme): void => {
    const committed = commitWalletChange((state) => ({ ...state, theme: nextTheme }));
    if (!committed.ok) showToast(committed.message);
  };

  const resetApplication = (): void => {
    const reset = createInitialWalletState();
    if (!resetWalletState().ok) {
      showToast("The application couldn’t be reset on this device");
      return;
    }
    const featurePreferenceReset = featureHost.reset();
    const toolPreferenceReset = toolPreferences.reset();
    setPersistenceEnabled(true);
    setUnavailableFeatures([]);
    storageWarningShown.current = false;
    setWallet(reset);
    setFirstCardCreationOpen(true);
    setContactQuery("");
    setContactManaging(false);
    setContactRemovalOpen(false);
    replace({ page: "settings" });
    showToast(
      featurePreferenceReset.persistence.mode === "persistent" && toolPreferenceReset
        ? "Application reset"
        : "Application reset, but feature settings couldn’t be saved",
    );
  };

  const overlayOpen =
    routeWithoutOverlay(route) !== null &&
    (route.page !== "card" || detail !== undefined) &&
    (route.page !== "person" || (peopleOperational && contact !== undefined)) &&
    (route.page !== "people" || peopleOperational);
  const flipSubject =
    flip?.kind === "contact"
      ? contacts.find((person) => person.id === flip.id)
      : flip
        ? cards.find((card) => card.id === flip.id)
        : undefined;
  const contactUrl = contact === undefined ? "" : shareUrlFor(contact);
  const sheetLabel =
    route.page === "person"
      ? route.sheet === "share"
        ? "Share contact"
        : "Edit contact"
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
            onCreate={() =>
              push({
                page: "wallet",
                cardId: cards[selectedIndex]?.id ?? activeId,
                sheet: "create",
              })
            }
            onConnectAccount={() => connectAccount(active.id)}
            onAccountTap={(account) =>
              showToast(
                `${account.username} is connected via ${PROVIDER_META[account.provider].name}`,
              )
            }
            {...(activityOperational
              ? {
                  secondary: (
                    <ActivitySummary
                      items={recentActivity}
                      onOpen={() => push({ page: "activity" })}
                    />
                  ),
                }
              : {})}
          />
        )}
        {(route.page === "people" || route.page === "person") &&
          peopleReadiness === "data-unavailable" && (
            <FeatureReadiness
              title="People"
              status="data-unavailable"
              {...(peopleEnabled
                ? {
                    onDisable: () => {
                      featureHost.disable("people");
                      replace({ page: "features" });
                    },
                  }
                : {})}
            />
          )}
        {(route.page === "people" || route.page === "person") &&
          !peopleEnabled &&
          peopleReadiness !== "data-unavailable" && (
            <DisabledFeature
              title={featureById("people").title}
              summary={featureById("people").summary}
              onEnable={() => featureHost.enable("people")}
            />
          )}
        {route.page === "people" && peopleOperational && (
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
        {route.page === "activity" &&
          (activityReadiness === "data-unavailable" ? (
            <FeatureReadiness
              title="Activity"
              status="data-unavailable"
              {...(activityEnabled
                ? {
                    onDisable: () => {
                      featureHost.disable("activity");
                      replace({ page: "features" });
                    },
                  }
                : {})}
            />
          ) : !activityEnabled ? (
            <DisabledFeature
              title={featureById("activity").title}
              summary={featureById("activity").summary}
              onEnable={() => featureHost.enable("activity")}
            />
          ) : (
            <Activity items={activity} />
          ))}
        {route.page === "tools" && !toolsEnabled && toolsReadiness !== "update-required" && (
          <DisabledFeature
            title={featureById("tools").title}
            summary={featureById("tools").summary}
            onEnable={() => featureHost.enable("tools")}
          />
        )}
        {route.page === "tools" &&
          toolsEnabled &&
          (toolsReadiness === "idle" || toolsReadiness === "preparing") && (
            <FeatureReadiness
              title="Tools"
              status="preparing"
              onRetry={() => void featureHost.prepare("tools")}
              onDisable={() => featureHost.disable("tools")}
            />
          )}
        {route.page === "tools" && toolsEnabled && toolsReadiness === "failed" && (
          <FeatureReadiness
            title="Tools"
            status="failed"
            onRetry={() => void featureHost.prepare("tools")}
            onDisable={() => {
              featureHost.disable("tools");
              replace({ page: "features" });
            }}
          />
        )}
        {route.page === "tools" && toolsReadiness === "update-required" && (
          <FeatureReadiness
            title="Tools"
            status="update-required"
            onReload={() => window.location.reload()}
            {...(toolsEnabled
              ? {
                  onDisable: () => {
                    featureHost.disable("tools");
                    replace({ page: "features" });
                  },
                }
              : {})}
          />
        )}
        {route.page === "tools" &&
          toolsEnabled &&
          (toolsReadiness === "ready" || toolsReadiness === "online-only") &&
          !toolOperationEnabled && (
            <DisabledFeature
              title={TOOL_FEATURES.find(({ id }) => id === route.operation)?.title ?? "Tool"}
              summary="This tool is turned off. You can turn it on without changing the other Tools features."
              onEnable={() => toolPreferences.setEnabled(route.operation, true)}
            />
          )}
        {route.page === "tools" &&
          toolsEnabled &&
          toolOperationEnabled &&
          (toolsReadiness === "ready" || toolsReadiness === "online-only") &&
          active !== undefined && (
            <FeatureBoundary
              feature="Tools"
              onError={(error) => featureHost.fail("tools", error)}
              onDisable={() => {
                featureHost.disable("tools");
                replace({ page: "features" });
              }}
            >
              <LazyTools
                active={active}
                cards={cards}
                contacts={peopleOperational ? contacts : []}
                operation={route.operation}
                enabledOperations={toolPreferences.enabled}
                onOperation={(operation) => push({ page: "tools", operation })}
                onToast={showToast}
              />
            </FeatureBoundary>
          )}
        {route.page === "features" && (
          <FeatureLibrary
            items={featureHost.libraryEntries.map((item) =>
              item.id === "tools"
                ? {
                    ...item,
                    children: TOOL_FEATURES.map((tool) => ({
                      ...tool,
                      enabled: toolPreferences.enabled.includes(tool.id),
                    })),
                  }
                : item,
            )}
            dockLabels={dockItems.map(({ label }) => label)}
            onBack={() => back({ page: "settings" })}
            onEnable={featureHost.enable}
            onDisable={featureHost.disable}
            onPin={featureHost.pin}
            onUnpin={featureHost.unpin}
            onMove={featureHost.reorder}
            onOpen={(id) => {
              if (isCurrentFeatureId(id)) openFeature(id);
            }}
            onRetry={featureHost.retry}
            onReload={() => window.location.reload()}
            onToggleChild={(parentId, id, enabled) => {
              if (parentId === "tools" && isToolOperation(id)) {
                toolPreferences.setEnabled(id, enabled);
              }
            }}
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
            onFeatures={() => push({ page: "features" })}
            onAppearance={() => push({ page: "settings", sheet: "appearance" })}
            onBackup={() => push({ page: "settings", sheet: "backup" })}
            onRestore={() => push({ page: "settings", sheet: "restore" })}
            onHelp={() => push({ page: "settings", sheet: "help" })}
            onReset={() => push({ page: "settings", sheet: "reset" })}
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
            onActivate={() => activate(detail)}
            onCopyPublicKey={(publicKey) => void copyPublicKey(publicKey)}
            onCopyPrivateKey={(privateKey) => void copyPrivateKey(privateKey)}
            onDisconnectAccount={disconnectAccount}
            onConnectAccount={() => connectAccount(detail.id)}
            onDelete={deleteIdentity}
            onRemovalDialogChange={setIdentityRemovalOpen}
          />
        )}
        {route.page === "person" && peopleOperational && contact !== undefined && (
          <ContactDetail
            contact={contact}
            profileLink={contactUrl}
            heroRef={contactHeroRef}
            heroHidden={flip !== null}
            onBack={backFromContact}
            onEdit={() => push({ page: "person", contactId: contact.id, sheet: "edit" })}
            onRemove={() => removeContactIds([contact.id])}
            onCopyProfileLink={() => void copyProfileLink(contactUrl)}
            onCopyPublicKey={() => void copyPublicKey(nostrPublicKey(contact.npub) ?? "")}
            onShare={() => push({ page: "person", contactId: contact.id, sheet: "share" })}
            onRemovalDialogChange={setContactRemovalOpen}
          />
        )}

        {!firstCardCreationOpen &&
          active !== undefined &&
          !overlayOpen &&
          !contactManaging &&
          !contactRemovalOpen &&
          !identityRemovalOpen && <BottomNav items={dockItems} current={navCurrent} onGo={go} />}

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
              <ShareSheet subject={detail} shareUrl={shareUrlFor(detail)} onToast={showToast} />
            )}
            {route.page === "person" && contact !== undefined && route.sheet === "share" && (
              <ShareSheet subject={contact} shareUrl={contactUrl} onToast={showToast} />
            )}
            {route.page === "card" && detail !== undefined && route.sheet === "edit" && (
              <EditSheet card={detail} onSave={saveEdit} onToast={showToast} />
            )}
            {route.page === "person" && contact !== undefined && route.sheet === "edit" && (
              <EditContactSheet contact={contact} onCancel={closeOverlay} onSave={saveContact} />
            )}
            {route.page === "settings" && route.sheet === "backup" && (
              <BackupSheet
                cards={cards}
                contactCount={contacts.length}
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
                onPreview={previewBackup}
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

export const App = (): ReactElement => (
  <WalletRouterProvider>
    <WalletApplication />
  </WalletRouterProvider>
);
