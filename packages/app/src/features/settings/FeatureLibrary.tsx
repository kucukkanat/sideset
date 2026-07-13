import { ActionButton } from "@shared/ui/ActionButton.tsx";
import { ScreenHeader } from "@shared/ui/ScreenHeader.tsx";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pin,
  PinOff,
  RefreshCw,
} from "lucide-react";
import { type ReactElement, useLayoutEffect, useRef, useState } from "react";

export interface FeatureLibraryItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly enabled: boolean;
  readonly pinned: boolean;
  readonly dockPosition: number | null;
  readonly dockEligible: boolean;
  readonly readiness:
    | "preparing"
    | "ready"
    | "online-only"
    | "failed"
    | "update-required"
    | "data-unavailable";
  readonly canMoveEarlier: boolean;
  readonly canMoveLater: boolean;
  readonly children?: readonly NestedFeatureLibraryItem[];
}

export interface NestedFeatureLibraryItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly enabled: boolean;
}

const enabledItems = (items: readonly FeatureLibraryItem[]): readonly FeatureLibraryItem[] =>
  items
    .filter(({ enabled }) => enabled)
    .toSorted((left, right) => {
      if (left.dockPosition !== null && right.dockPosition !== null) {
        return left.dockPosition - right.dockPosition;
      }
      if (left.dockPosition !== null) return -1;
      if (right.dockPosition !== null) return 1;
      return left.title.localeCompare(right.title);
    });

const availableItems = (items: readonly FeatureLibraryItem[]): readonly FeatureLibraryItem[] =>
  items
    .filter(({ enabled }) => !enabled)
    .toSorted((left, right) => left.title.localeCompare(right.title));

interface FeatureLibraryProps {
  readonly items: readonly FeatureLibraryItem[];
  readonly dockLabels: readonly string[];
  readonly onBack: () => void;
  readonly onEnable: (id: string) => void | Promise<void>;
  readonly onDisable: (id: string) => void;
  readonly onPin: (id: string) => void;
  readonly onUnpin: (id: string) => void;
  readonly onMove: (id: string, direction: "earlier" | "later") => void;
  readonly onOpen: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onReload: () => void;
  readonly onToggleChild?: (parentId: string, id: string, enabled: boolean) => void;
}

export const FeatureLibrary = ({
  items,
  dockLabels,
  onBack,
  onEnable,
  onDisable,
  onPin,
  onUnpin,
  onMove,
  onOpen,
  onRetry,
  onReload,
  onToggleChild = () => undefined,
}: FeatureLibraryProps): ReactElement => {
  const [focusAfterToggle, setFocusAfterToggle] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (focusAfterToggle === null) return;
    const toggle = document.querySelector<HTMLButtonElement>(
      `[data-testid=${JSON.stringify(`feature-${focusAfterToggle}-toggle`)}]`,
    );
    if (toggle === null) return;
    toggle.focus({ preventScroll: true });
    setFocusAfterToggle(null);
  }, [focusAfterToggle]);

  return (
    <div data-testid="screen-features" className="scr screen">
      <ScreenHeader
        title="Features"
        subtitle="Choose what is active and what belongs in your dock"
        actions={
          <ActionButton data-testid="features-back" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={17} /> Settings
          </ActionButton>
        }
      />

      <section
        className="app-page-content feature-library-section"
        aria-labelledby="features-dock-title"
      >
        <div>
          <div id="features-dock-title" className="sec-label">
            Dock preview
          </div>
          <div className="feature-dock-preview" data-testid="features-dock-preview">
            {dockLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
        <p className="feature-library-note">
          Wallet and Settings stay fixed. You can add up to two feature shortcuts.
        </p>
      </section>

      <section
        className="app-page-content feature-library-section"
        aria-labelledby="features-enabled-title"
      >
        <div id="features-enabled-title" className="sec-label">
          Enabled
        </div>
        {enabledItems(items).map((item) => (
          <FeatureCard
            key={item.id}
            item={item}
            onEnable={onEnable}
            onDisable={onDisable}
            onPin={onPin}
            onUnpin={onUnpin}
            onMove={onMove}
            onOpen={onOpen}
            onRetry={onRetry}
            onReload={onReload}
            onToggleChild={onToggleChild}
            onToggleSettled={setFocusAfterToggle}
          />
        ))}
      </section>

      {items.some(({ enabled }) => !enabled) && (
        <section
          className="app-page-content feature-library-section"
          aria-labelledby="features-available-title"
        >
          <div id="features-available-title" className="sec-label">
            Available
          </div>
          {availableItems(items).map((item) => (
            <FeatureCard
              key={item.id}
              item={item}
              onEnable={onEnable}
              onDisable={onDisable}
              onPin={onPin}
              onUnpin={onUnpin}
              onMove={onMove}
              onOpen={onOpen}
              onRetry={onRetry}
              onReload={onReload}
              onToggleChild={onToggleChild}
              onToggleSettled={setFocusAfterToggle}
            />
          ))}
        </section>
      )}
    </div>
  );
};

const FeatureCard = ({
  item,
  onEnable,
  onDisable,
  onPin,
  onUnpin,
  onMove,
  onOpen,
  onRetry,
  onReload,
  onToggleSettled,
  onToggleChild,
}: {
  readonly item: FeatureLibraryItem;
  readonly onEnable: (id: string) => void | Promise<void>;
  readonly onDisable: (id: string) => void;
  readonly onPin: (id: string) => void;
  readonly onUnpin: (id: string) => void;
  readonly onMove: (id: string, direction: "earlier" | "later") => void;
  readonly onOpen: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onReload: () => void;
  readonly onToggleSettled: (id: string) => void;
  readonly onToggleChild: (parentId: string, id: string, enabled: boolean) => void;
}): ReactElement => {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const externallyPreparing = item.enabled && item.readiness === "preparing";
  const assetUnavailable = item.enabled && item.readiness === "failed";
  const updateRequired = item.readiness === "update-required";
  const dataUnavailable = item.readiness === "data-unavailable";
  const unavailable = assetUnavailable || updateRequired || dataUnavailable;
  const busy = pending || externallyPreparing;
  const toggle = async (): Promise<void> => {
    if (pendingRef.current) return;
    if (item.enabled) {
      onDisable(item.id);
      onToggleSettled(item.id);
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      await onEnable(item.id);
    } finally {
      pendingRef.current = false;
      setPending(false);
      onToggleSettled(item.id);
    }
  };

  return (
    <article className="panel feature-library-card" data-testid={`feature-${item.id}`}>
      <div className="feature-library-copy">
        <h2>{item.title}</h2>
        <p>{item.summary}</p>
      </div>
      <div className="feature-library-actions">
        <ActionButton
          data-testid={`feature-${item.id}-toggle`}
          variant={item.enabled ? "danger" : "primary"}
          aria-label={`${item.enabled ? "Turn off" : "Turn on"} ${item.title}`}
          aria-pressed={item.enabled}
          aria-busy={busy}
          disabled={pending || (!item.enabled && updateRequired)}
          onClick={() => void toggle()}
        >
          {item.enabled ? "Turn off" : "Turn on"}
        </ActionButton>
        {item.enabled && (
          <ActionButton
            data-testid={`feature-${item.id}-open`}
            variant="secondary"
            aria-label={`Open ${item.title}`}
            disabled={busy || unavailable}
            onClick={() => onOpen(item.id)}
          >
            <ExternalLink aria-hidden="true" size={16} /> Open
          </ActionButton>
        )}
        {item.dockEligible && (
          <ActionButton
            data-testid={`feature-${item.id}-dock`}
            variant="secondary"
            disabled={!item.enabled || pending || updateRequired || dataUnavailable}
            aria-label={`${item.pinned ? "Remove" : "Show"} ${item.title} ${
              item.pinned ? "from" : "in"
            } dock`}
            aria-pressed={item.pinned}
            onClick={() => (item.pinned ? onUnpin(item.id) : onPin(item.id))}
          >
            {item.pinned ? (
              <PinOff aria-hidden="true" size={16} />
            ) : (
              <Pin aria-hidden="true" size={16} />
            )}
            {item.pinned ? "Remove from dock" : "Show in dock"}
          </ActionButton>
        )}
        {item.pinned && (
          <div
            className="feature-library-order"
            role="group"
            aria-label={`${item.title} dock position`}
          >
            <ActionButton
              data-testid={`feature-${item.id}-earlier`}
              iconOnly
              disabled={!item.canMoveEarlier}
              aria-label={`Move ${item.title} earlier`}
              onClick={() => onMove(item.id, "earlier")}
            >
              <ChevronLeft aria-hidden="true" size={17} />
            </ActionButton>
            <ActionButton
              data-testid={`feature-${item.id}-later`}
              iconOnly
              disabled={!item.canMoveLater}
              aria-label={`Move ${item.title} later`}
              onClick={() => onMove(item.id, "later")}
            >
              <ChevronRight aria-hidden="true" size={17} />
            </ActionButton>
          </div>
        )}
        {pending && (
          <span className="feature-library-status" role="status" aria-live="polite">
            Downloading {item.title}…
          </span>
        )}
        {!pending && externallyPreparing && (
          <span className="feature-library-status" role="status" aria-live="polite">
            Downloading {item.title} for offline use…
          </span>
        )}
        {!pending && assetUnavailable && (
          <div className="feature-library-actions" role="alert">
            <span className="feature-library-status">Download interrupted</span>
            <ActionButton
              data-testid={`feature-${item.id}-retry`}
              variant="secondary"
              onClick={() => onRetry(item.id)}
            >
              Retry
            </ActionButton>
          </div>
        )}
        {!pending && updateRequired && (
          <div className="feature-library-actions" role="alert">
            <span className="feature-library-status">Reload to use the app update</span>
            <ActionButton
              data-testid={`feature-${item.id}-reload`}
              variant="secondary"
              onClick={onReload}
            >
              <RefreshCw aria-hidden="true" size={16} /> Reload to update
            </ActionButton>
          </div>
        )}
        {!pending && dataUnavailable && (
          <span className="feature-library-status" role="alert">
            Saved data unavailable; original data preserved
          </span>
        )}
        {!pending && item.enabled && item.readiness === "online-only" && (
          <span className="feature-library-status">Online only in this browser</span>
        )}
      </div>
      {item.enabled && item.children !== undefined && (
        <div
          className="feature-library-children"
          role="group"
          aria-label={`${item.title} features`}
        >
          {item.children.map((child) => (
            <div className="feature-library-child" key={child.id}>
              <div className="feature-library-copy">
                <h3>{child.title}</h3>
                <p>{child.summary}</p>
              </div>
              <ActionButton
                data-testid={`feature-${item.id}-${child.id}-toggle`}
                variant={child.enabled ? "danger" : "primary"}
                aria-label={`${child.enabled ? "Turn off" : "Turn on"} ${child.title}`}
                aria-pressed={child.enabled}
                onClick={() => onToggleChild(item.id, child.id, !child.enabled)}
              >
                {child.enabled ? "Turn off" : "Turn on"}
              </ActionButton>
            </div>
          ))}
        </div>
      )}
    </article>
  );
};
