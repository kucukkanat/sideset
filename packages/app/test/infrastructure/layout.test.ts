import { describe, expect, test } from "bun:test";

describe("layout geometry", () => {
  test("keeps the identity picker inside the wallet content gutter", async () => {
    const styles = await Bun.file(new URL("../../src/styles.css", import.meta.url)).text();
    const picker = styles.match(/\.wallet-identity-picker \{(?<rules>[^}]*)\}/u)?.groups?.rules;

    expect(picker).toContain("margin: 0");
    expect(picker).toContain("padding: var(--space-2) 0 var(--space-2)");
    expect(picker).not.toContain("-1 * var(--layout-gutter)");
  });
});
