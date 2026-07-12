import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import type { Card } from "@keychain/core";
import type { CSSProperties, ReactElement } from "react";

const generatedAvatar = (seed: string): string => createAvatar(notionists, { seed }).toDataUri();

export const CardAvatar = ({
  card,
  className,
  style,
}: {
  card: Pick<Card, "id" | "avatar" | "identity">;
  className?: string;
  style?: CSSProperties;
}): ReactElement =>
  card.avatar.startsWith("data:image/") ? (
    <img
      className={className}
      style={{ display: "block", objectFit: "cover", borderRadius: "30%", ...style }}
      data-testid="card-uploaded-avatar"
      src={card.avatar}
      alt=""
    />
  ) : card.avatar.length > 0 ? (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        ...style,
      }}
      data-testid="card-custom-avatar"
    >
      {card.avatar}
    </span>
  ) : (
    <img
      className={className}
      style={{
        display: "block",
        objectFit: "contain",
        borderRadius: "30%",
        overflow: "hidden",
        ...style,
      }}
      data-testid="card-generated-avatar"
      src={generatedAvatar(card.identity?.publicKey ?? card.id)}
      alt=""
    />
  );
