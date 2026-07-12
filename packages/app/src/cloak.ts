export const MAX_CLOAK_SECRET_LENGTH = 10_000;
export const MAX_CLOAK_COVER_LENGTH = 20_000;
export const MAX_CLOAKED_MESSAGE_LENGTH = 1_000_000;
export const MIN_CLOAK_PASSWORD_LENGTH = 8;

const INVISIBLE_CHARACTERS = /(?:\u200c|\u200d|\u2061|\u2062|\u2063|\u2064)/gu;

const createStegCloak = async (protectedMessage: boolean) => {
  const { Buffer } = await import("buffer");
  const browserGlobals = globalThis as typeof globalThis & {
    Buffer?: typeof Buffer;
    global?: typeof globalThis;
  };
  browserGlobals.Buffer ??= Buffer;
  browserGlobals.global ??= globalThis;
  const { default: StegCloak } = await import("stegcloak");
  return new StegCloak(protectedMessage, protectedMessage);
};

export type CloakFailure =
  | { readonly code: "empty-secret"; readonly message: string }
  | { readonly code: "secret-too-long"; readonly message: string }
  | { readonly code: "short-cover"; readonly message: string }
  | { readonly code: "cover-too-long"; readonly message: string }
  | { readonly code: "invalid-cover"; readonly message: string }
  | { readonly code: "short-password"; readonly message: string }
  | { readonly code: "empty-cloak"; readonly message: string }
  | { readonly code: "cloak-too-long"; readonly message: string }
  | { readonly code: "invalid-cloak"; readonly message: string }
  | { readonly code: "wrong-password"; readonly message: string }
  | { readonly code: "cloak-failed"; readonly message: string };

export type CloakResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: CloakFailure };

const failure = (error: CloakFailure): CloakResult => ({ ok: false, error });

export const visibleCloakText = (value: string): string => value.replace(INVISIBLE_CHARACTERS, "");

export const hideWithCloak = async (
  secret: string,
  cover: string,
  password: string,
): Promise<CloakResult> => {
  if (secret.trim().length === 0) {
    return failure({ code: "empty-secret", message: "Enter the message you want to hide." });
  }
  if (secret.length > MAX_CLOAK_SECRET_LENGTH) {
    return failure({ code: "secret-too-long", message: "The hidden message is too long." });
  }
  const coverWords = cover.split(" ");
  if (coverWords.filter((word) => word.length > 0).length < 2) {
    return failure({
      code: "short-cover",
      message: "The visible message needs at least two words.",
    });
  }
  if (cover.length > MAX_CLOAK_COVER_LENGTH) {
    return failure({ code: "cover-too-long", message: "The visible message is too long." });
  }
  if (coverWords.some((word) => word.length === 0)) {
    return failure({
      code: "invalid-cover",
      message: "Remove extra spaces at the start, end, or between words.",
    });
  }
  if (cover.search(INVISIBLE_CHARACTERS) !== -1) {
    return failure({
      code: "invalid-cover",
      message: "That visible message already contains invisible characters. Use different text.",
    });
  }
  if (password.length > 0 && password.length < MIN_CLOAK_PASSWORD_LENGTH) {
    return failure({
      code: "short-password",
      message: "Use at least 8 characters, or leave the password blank.",
    });
  }

  try {
    const stegcloak = await createStegCloak(password.length > 0);
    const value = stegcloak.hide(secret, password, cover);
    return value.length <= MAX_CLOAKED_MESSAGE_LENGTH
      ? { ok: true, value }
      : failure({
          code: "cloak-too-long",
          message: "That hidden message is too large to cloak safely here.",
        });
  } catch {
    return failure({ code: "cloak-failed", message: "We couldn’t cloak that message." });
  }
};

export const revealWithCloak = async (cloaked: string, password: string): Promise<CloakResult> => {
  if (cloaked.trim().length === 0) {
    return failure({ code: "empty-cloak", message: "Paste the cloaked message first." });
  }
  if (cloaked.length > MAX_CLOAKED_MESSAGE_LENGTH) {
    return failure({ code: "cloak-too-long", message: "That cloaked message is too long." });
  }
  if (cloaked.search(INVISIBLE_CHARACTERS) === -1) {
    return failure({
      code: "invalid-cloak",
      message: "We couldn’t find a hidden message in that text.",
    });
  }

  try {
    const stegcloak = await createStegCloak(false);
    return { ok: true, value: stegcloak.reveal(cloaked, password) };
  } catch {
    return failure({
      code: "wrong-password",
      message: "That password didn’t work, or the cloaked message was changed.",
    });
  }
};
