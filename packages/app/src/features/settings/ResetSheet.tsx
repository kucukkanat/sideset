import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";

export const ResetSheet = ({ onReset }: { onReset: () => void }): ReactElement => (
  <div data-testid="reset-sheet" style={{ animation: "riseIn .4s ease", textAlign: "center" }}>
    <Trash2 aria-hidden="true" size={44} style={{ marginBottom: 12 }} />
    <div className="sheet-title">Reset Keychain?</div>
    <div className="sheet-lead" style={{ maxWidth: 310 }}>
      This permanently erases every card, contact, connected account, and activity stored on this
      device. The original sample data and default appearance will be restored.
    </div>
    <div
      data-testid="reset-warning"
      style={{
        background: "var(--kc-warning-bg)",
        color: "var(--kc-warning-text)",
        borderRadius: 14,
        padding: "13px 15px",
        marginTop: 20,
        fontSize: 12.5,
        fontWeight: 700,
        lineHeight: 1.45,
      }}
    >
      Export a backup first if you may need this data again.
    </div>
    <button
      type="button"
      data-testid="reset-confirm"
      className="btn-dark press"
      onClick={onReset}
      style={{ marginTop: 20, border: 0, background: "#C43D32", ["--press" as string]: 0.97 }}
    >
      Erase data and reset
    </button>
  </div>
);
