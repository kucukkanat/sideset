import { type Card, EMOJI_CHOICES, paletteFor } from "@keychain/core";
import { type ReactElement, useState } from "react";

export const EditSheet = ({
  card,
  onSave,
}: {
  card: Card;
  onSave: (patch: { name: string; bio: string; avatar: string }) => void;
}): ReactElement => {
  const [name, setName] = useState(card.name);
  const [bio, setBio] = useState(card.bio);
  const [avatar, setAvatar] = useState(card.avatar);
  const pal = paletteFor(card.color);

  return (
    <div data-testid="edit-card-sheet" style={{ animation: "riseIn .4s ease" }}>
      <div style={{ textAlign: "center" }}>
        <div className="sheet-title">Edit card</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 28,
            background: pal.grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            boxShadow: `0 10px 24px -10px ${pal.shadow}`,
          }}
        >
          {avatar}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 9,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        {EMOJI_CHOICES.map((emoji) => (
          <div
            key={emoji}
            data-testid={`edit-card-avatar-${emoji}`}
            role="button"
            onClick={() => setAvatar(emoji)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 21,
              cursor: "pointer",
              transition: "transform .15s",
              background: avatar === emoji ? "#1B1917" : "#F2EBE0",
              transform: `scale(${avatar === emoji ? 1.05 : 1})`,
            }}
          >
            {emoji}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
          Name
        </div>
        <input
          data-testid="edit-card-name"
          className="input"
          maxLength={50}
          style={{ padding: 15 }}
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
          About you
        </div>
        <textarea
          data-testid="edit-card-bio"
          className="input"
          maxLength={280}
          rows={3}
          style={{ padding: 15, fontSize: 15, fontWeight: 600, resize: "none", lineHeight: 1.5 }}
          value={bio}
          onInput={(e) => setBio(e.currentTarget.value)}
        />
      </div>
      <div
        role="button"
        data-testid="edit-card-save"
        className="btn-dark press"
        onClick={() => onSave({ name, bio, avatar })}
        style={{ marginTop: 22, ["--press" as string]: 0.97 }}
      >
        Save changes
      </div>
    </div>
  );
};
