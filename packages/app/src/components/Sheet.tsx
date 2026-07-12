import { X } from "lucide-react";
import { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Bottom sheet with two ways to drag-close: the grab handle always drags, and
 * the body drags only when its scroller is already at the top (otherwise it scrolls).
 */
export const Sheet = ({
  onClose,
  children,
  label = "Dialog",
  dismissible = true,
}: {
  onClose: () => void;
  children: ReactNode;
  label?: string;
  dismissible?: boolean;
}): ReactElement => {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector =
      "[autofocus],input:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href]";
    const focusFrame = requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      const preferred =
        sheet?.querySelector<HTMLElement>("[autofocus]") ??
        sheet?.querySelector<HTMLElement>("input:not([disabled]),textarea:not([disabled])") ??
        sheet?.querySelector<HTMLElement>("button:not([disabled]),a[href]");
      preferred?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || sheetRef.current === null) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onClose]);

  const trackDrag = (
    startY: number,
    shouldDrag: (dy: number) => boolean | null,
    threshold: number,
  ): void => {
    let locked: "drag" | "scroll" | null = null;
    let lastDy = 0;
    const move = (ev: PointerEvent): void => {
      const dy = ev.clientY - startY;
      if (locked === null) {
        const decision = shouldDrag(dy);
        if (decision === null) return;
        locked = decision ? "drag" : "scroll";
        if (locked === "drag") setDragging(true);
      }
      if (locked === "drag") {
        if (ev.cancelable) ev.preventDefault();
        lastDy = Math.max(0, dy);
        setDragY(lastDy);
      }
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (locked !== "drag") return;
      if (lastDy > threshold) onClose();
      else {
        setDragY(0);
        setDragging(false);
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
  };

  const onHandleDown = (e: React.PointerEvent): void => {
    if (!dismissible) return;
    e.preventDefault();
    trackDrag(e.clientY, () => true, 120);
  };

  const onBodyDown = (e: React.PointerEvent): void => {
    if (!dismissible) return;
    const tag = e.target instanceof HTMLElement ? e.target.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const scroller = e.currentTarget;
    trackDrag(
      e.clientY,
      (dy) => (Math.abs(dy) < 6 ? null : dy > 0 && scroller.scrollTop <= 0),
      110,
    );
  };

  return (
    <>
      <div
        data-testid="sheet-backdrop"
        onClick={dismissible ? onClose : undefined}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 80,
          background: "rgba(30,20,10,.42)",
          backdropFilter: "blur(3px)",
          animation: "fadeIn .28s ease",
        }}
      />
      <div
        ref={sheetRef}
        data-testid="sheet"
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform .34s cubic-bezier(.2,.9,.3,1)",
          animation: dragY ? "none" : "sheetUp .4s cubic-bezier(.2,.9,.3,1)",
        }}
      >
        <div
          data-testid="sheet-handle"
          onPointerDown={onHandleDown}
          style={{
            position: "relative",
            padding: "12px 0 4px",
            display: "flex",
            justifyContent: "center",
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <div style={{ width: 38, height: 5, borderRadius: 3, background: "#DAD0C1" }} />
          <button
            type="button"
            data-testid="sheet-close"
            aria-label="Close"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            style={{
              position: "absolute",
              top: 8,
              right: 16,
              width: 40,
              height: 40,
              border: "none",
              borderRadius: "50%",
              background: "var(--kc-surface-raised)",
              color: "var(--kc-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X aria-hidden="true" size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div
          data-testid="sheet-content"
          className="scr"
          onPointerDown={onBodyDown}
          style={{
            overflowY: "auto",
            maxHeight: "78vh",
            padding: "8px 24px calc(34px + env(safe-area-inset-bottom))",
            touchAction: "pan-y",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};
