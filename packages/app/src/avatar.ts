export const MAX_AVATAR_BYTES = 4_000_000;

const MAX_DATA_URL_CHARS = 23 + 4 * Math.ceil(MAX_AVATAR_BYTES / 3);
const DATA_URL = /^data:image\/(?:gif|jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/u;

export const isAvatar = (value: unknown): value is string =>
  typeof value === "string" &&
  (value.length <= 16 || (value.length <= MAX_DATA_URL_CHARS && DATA_URL.test(value)));
