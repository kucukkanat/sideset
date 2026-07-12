export const MAX_AVATAR_BYTES = 4_000_000;

const MAX_DATA_URL_CHARS = 23 + 4 * Math.ceil(MAX_AVATAR_BYTES / 3);
const DATA_URL = /^data:image\/(?:gif|jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/u;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type AvatarFileResult =
  | { readonly ok: true; readonly avatar: string }
  | { readonly ok: false; readonly message: string };

export const isAvatar = (value: unknown): value is string =>
  typeof value === "string" &&
  (value.length <= 16 || (value.length <= MAX_DATA_URL_CHARS && DATA_URL.test(value)));

export const readAvatarFile = async (file: File): Promise<AvatarFileResult> => {
  if (!IMAGE_TYPES.has(file.type)) {
    return { ok: false, message: "Choose a JPEG, PNG, WebP, or GIF image" };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, message: "Choose an image no larger than 4 MB" };
  }
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      resolve(
        typeof reader.result === "string"
          ? { ok: true, avatar: reader.result }
          : { ok: false, message: "Couldn't read that image" },
      ),
    );
    reader.addEventListener("error", () =>
      resolve({ ok: false, message: "Couldn't read that image" }),
    );
    reader.readAsDataURL(file);
  });
};
