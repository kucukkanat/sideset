import { type ReactElement, type ReactNode, useState } from "react";

/**
 * Bottom sheet with two ways to drag-close: the grab handle always drags, and
 * the body drags only when its scroller is already at the top (otherwise it scrolls).
 */
export const Sheet = ({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}): ReactElement => {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

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
    e.preventDefault();
    trackDrag(e.clientY, () => true, 120);
  };

  const onBodyDown = (e: React.PointerEvent): void => {
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
        onClick={onClose}
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
        className="sheet"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform .34s cubic-bezier(.2,.9,.3,1)",
          animation: dragY ? "none" : "sheetUp .4s cubic-bezier(.2,.9,.3,1)",
        }}
      >
        <div
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
              width: 30,
              height: 30,
              border: "none",
              borderRadius: "50%",
              background: "#ECE4D8",
              color: "#8A7A64",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              role="img"
              aria-label="Close"
            >
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>
        <div
          className="scr"
          onPointerDown={onBodyDown}
          style={{
            overflowY: "auto",
            maxHeight: "78vh",
            padding: "8px 24px 34px",
            touchAction: "pan-y",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};
