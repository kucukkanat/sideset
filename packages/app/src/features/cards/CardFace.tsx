import { CardAvatar } from "@features/cards/CardAvatar.tsx";
import { type Card, paletteFor, proofsSummary } from "@keychain/core";
import { PersonIcon } from "@shared/ui/icons.tsx";
import type { CSSProperties, ReactElement } from "react";

interface CardFaceProps {
  readonly card: Card;
  readonly active: boolean;
  readonly dim?: number;
  readonly dimTransition?: CSSProperties["transition"];
  readonly borderRadius?: CSSProperties["borderRadius"];
}

/** The shared visual face used by both carousel cards and their flip overlay. */
export const CardFace = ({
  card,
  active,
  dim = 0,
  dimTransition,
  borderRadius = 24,
}: CardFaceProps): ReactElement => {
  const palette = paletteFor(card.color);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius,
        background: palette.grad,
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        boxShadow: `0 22px 46px -18px ${palette.shadow},0 2px 6px rgba(0,0,0,.12),0 0 0 1px rgba(255,255,255,.14) inset`,
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
          background: "#0A0908",
          opacity: dim,
          transition: dimTransition,
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
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 26,
                background: "rgba(255,255,255,.22)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 44,
                boxShadow: "0 0 0 1px rgba(255,255,255,.25) inset",
                flex: "0 0 auto",
              }}
            >
              <CardAvatar card={card} style={{ width: "100%", height: "100%" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                data-card-field="name"
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: -0.2,
                  lineHeight: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {card.name}
              </div>
              <div
                data-card-field="tag"
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  opacity: 0.82,
                  marginTop: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {card.tag}
              </div>
            </div>
          </div>
          {active && (
            <div
              data-card-field="proofs"
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
                flex: "0 0 auto",
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
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                opacity: 0.7,
                letterSpacing: 1.5,
              }}
            >
              CONNECTED ACCOUNTS
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                opacity: 0.95,
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {proofsSummary(card.proofs ?? [])}
            </div>
          </div>
          <PersonIcon />
        </div>
      </div>
    </div>
  );
};
