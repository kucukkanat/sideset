import { CardAvatar } from "@features/cards/CardAvatar.tsx";
import { type Card, paletteFor } from "@keychain/core";
import { readAvatarFile } from "@shared/lib/avatar.ts";
import { Upload } from "lucide-react";
import { type FormEvent, type ReactElement, useState } from "react";

export const EditSheet = ({
  card,
  onSave,
  onToast,
}: {
  card: Card;
  onSave: (patch: {
    name: string;
    username: string;
    email: string;
    bio: string;
    avatar: string;
  }) => void;
  onToast: (message: string) => void;
}): ReactElement => {
  const [name, setName] = useState(card.name);
  const [username, setUsername] = useState(card.username);
  const [email, setEmail] = useState(card.email);
  const [bio, setBio] = useState(card.bio);
  const [avatar, setAvatar] = useState(card.avatar);
  const pal = paletteFor(card.color);
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSave({ name, username, email, bio, avatar });
  };
  const uploadAvatar = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    const result = await readAvatarFile(file);
    if (result.ok) setAvatar(result.avatar);
    else onToast(result.message);
  };

  return (
    <form data-testid="edit-card-sheet" onSubmit={submit} style={{ animation: "riseIn .4s ease" }}>
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
          <CardAvatar card={{ ...card, avatar }} style={{ width: 78, height: 78 }} />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          data-testid="edit-card-avatar-remove"
          className="press"
          onClick={() => setAvatar("")}
          style={{
            minHeight: 42,
            border: "1px solid color-mix(in srgb, var(--kc-warning-text) 24%, transparent)",
            borderRadius: 13,
            padding: "10px 15px",
            background: "var(--kc-warning-bg)",
            color: "var(--kc-warning-text)",
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.2,
            cursor: "pointer",
            ["--press" as string]: 0.97,
          }}
        >
          Remove picture
        </button>
        <label
          aria-label="Upload a profile picture"
          className="press"
          style={{
            minHeight: 42,
            borderRadius: 13,
            padding: "10px 15px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--kc-text)",
            background: "var(--kc-surface-raised)",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            ["--press" as string]: 0.97,
          }}
        >
          <Upload aria-hidden="true" size={18} />
          Upload picture
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            data-testid="edit-card-avatar-upload"
            aria-label="Upload a profile picture"
            onChange={(event) => void uploadAvatar(event.currentTarget.files?.[0])}
            style={{ display: "none" }}
          />
        </label>
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
          Name
        </div>
        <input
          data-testid="edit-card-name"
          className="input"
          maxLength={50}
          style={{ padding: 16 }}
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
          Username
        </div>
        <input
          data-testid="edit-card-username"
          className="input"
          maxLength={80}
          style={{ padding: 16 }}
          value={username}
          onInput={(event) => setUsername(event.currentTarget.value)}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <div className="sec-label" style={{ letterSpacing: 0.6, marginBottom: 8 }}>
          Email
        </div>
        <input
          data-testid="edit-card-email"
          className="input"
          type="email"
          maxLength={254}
          style={{ padding: 16 }}
          value={email}
          onInput={(event) => setEmail(event.currentTarget.value)}
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
          style={{
            padding: 16,
            fontSize: 15,
            fontWeight: 600,
            resize: "none",
            lineHeight: 1.5,
          }}
          value={bio}
          onInput={(e) => setBio(e.currentTarget.value)}
        />
      </div>
      <button
        type="submit"
        data-testid="edit-card-save"
        className="btn-dark press"
        style={{ marginTop: 20, border: 0, ["--press" as string]: 0.97 }}
      >
        Save changes
      </button>
    </form>
  );
};
