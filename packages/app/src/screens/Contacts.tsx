import { type Contact, paletteFor } from "@keychain/core";
import { type MutableRefObject, type ReactElement, useEffect, useRef } from "react";
import { PlusIcon } from "../icons.tsx";

interface ContactsProps {
  contacts: readonly Contact[];
  cardEls: MutableRefObject<Record<string, HTMLDivElement>>;
  savedScroll: MutableRefObject<number>;
  onOpen: (id: string, el: HTMLElement | null) => void;
  onAdd: () => void;
}

/**
 * Vertical card wall: cards scale and fade with distance from the viewport
 * centre. Transforms are applied imperatively (rAF-throttled) — driving them
 * through state would re-render the whole list on every scroll frame.
 */
export const Contacts = ({
  contacts,
  cardEls,
  savedScroll,
  onOpen,
  onAdd,
}: ContactsProps): ReactElement => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);

  const applyTransforms = (): void => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    const centre = r.top + r.height * 0.5;
    for (const p of contacts) {
      const el = cardEls.current[p.id];
      if (!el?.isConnected) continue;
      const b = el.getBoundingClientRect();
      const d = Math.min(Math.abs(b.top + b.height / 2 - centre) / (r.height * 0.5), 1);
      el.style.transform = `scale(${(1 - d * 0.14).toFixed(3)})`;
      el.style.opacity = (1 - d * 0.5).toFixed(3);
      el.style.zIndex = String(Math.round(100 - d * 80));
    }
  };

  const onScroll = (): void => {
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      applyTransforms();
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount — restore scroll, then position cards.
  useEffect(() => {
    const sc = scrollerRef.current;
    if (sc && savedScroll.current) sc.scrollTop = savedScroll.current;
    applyTransforms();
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div
      className="scr screen"
      ref={scrollerRef}
      onScroll={onScroll}
      style={{ scrollSnapType: "y proximity" }}
    >
      <div className="screen-hdr">
        <div>
          <div className="hdr-sub">People you follow</div>
          <div className="hdr-title">Contacts</div>
        </div>
        <div
          role="button"
          className="round-btn press"
          style={{ ["--press" as string]: 0.9 }}
          onClick={onAdd}
        >
          <PlusIcon stroke="#1B1917" size={22} width={2.2} />
        </div>
      </div>
      <div
        style={{
          padding: "14px 30px 34px",
          display: "flex",
          flexDirection: "column",
          perspective: 1200,
        }}
      >
        {contacts.map((p, i) => {
          const pal = paletteFor(p.color);
          return (
            <div
              key={p.id}
              role="button"
              ref={(el) => {
                if (el) cardEls.current[p.id] = el;
              }}
              onClick={(e) => {
                savedScroll.current = scrollerRef.current?.scrollTop ?? 0;
                onOpen(p.id, e.currentTarget);
              }}
              style={{
                position: "relative",
                marginTop: i === 0 ? 0 : 14,
                scrollSnapAlign: "center",
                transformOrigin: "center center",
                willChange: "transform,opacity",
                transition: "transform .25s ease,opacity .25s ease",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: 160,
                  borderRadius: 24,
                  background: pal.grad,
                  overflow: "hidden",
                  boxShadow: `0 22px 46px -20px ${pal.shadow},0 2px 6px rgba(0,0,0,.12),0 0 0 1px rgba(255,255,255,.14) inset`,
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
                    bottom: "-30%",
                    right: "-15%",
                    width: "60%",
                    height: "90%",
                    background: "radial-gradient(closest-side, rgba(0,0,0,.14), transparent)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    padding: "20px 22px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    color: "#fff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        background: "rgba(255,255,255,.22)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        boxShadow: "0 0 0 1px rgba(255,255,255,.25) inset",
                        flex: "0 0 auto",
                      }}
                    >
                      {p.avatar}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          letterSpacing: -0.3,
                          lineHeight: 1,
                        }}
                      >
                        {p.name}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.82, marginTop: 5 }}>
                        {p.handle}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "rgba(255,255,255,.2)",
                        padding: "6px 11px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        flex: "0 0 auto",
                      }}
                    >
                      {p.mutuals} mutual
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.92, lineHeight: 1.45 }}>
                    {p.bio}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
