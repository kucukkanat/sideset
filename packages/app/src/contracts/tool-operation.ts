/** Stable compatibility values for the reserved `/tools/:operation` route family. */
export const TOOL_OPERATIONS = ["encrypt", "decrypt", "sign", "verify", "cloak"] as const;
export type ToolOperation = (typeof TOOL_OPERATIONS)[number];

export interface ToolFeatureDescriptor {
  readonly id: ToolOperation;
  readonly title: string;
  readonly summary: string;
}

export const TOOL_FEATURES: readonly ToolFeatureDescriptor[] = [
  {
    id: "encrypt",
    title: "Encrypt",
    summary: "Encrypt text or files for a recipient or passphrase.",
  },
  { id: "decrypt", title: "Decrypt", summary: "Decrypt text or files received from someone else." },
  { id: "sign", title: "Sign", summary: "Sign text with your active identity." },
  { id: "verify", title: "Verify", summary: "Verify a signed document and its author." },
  { id: "cloak", title: "Cloak", summary: "Hide a secret inside ordinary-looking text." },
];

export const isToolOperation = (value: string): value is ToolOperation =>
  TOOL_OPERATIONS.some((operation) => operation === value);
