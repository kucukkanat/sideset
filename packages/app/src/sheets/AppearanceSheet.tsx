import type { ReactElement } from "react";
import type { ThemePreference } from "../screens/Settings.tsx";

const OPTIONS: readonly {
  readonly value: ThemePreference;
  readonly icon: string;
  readonly label: string;
  readonly description: string;
}[] = [
  { value: "system", icon: "⚙️", label: "Use device setting", description: "Match this device" },
  { value: "light", icon: "☀️", label: "Light", description: "Always use the light theme" },
  { value: "dark", icon: "🌙", label: "Dark", description: "Always use the dark theme" },
];

export const AppearanceSheet = ({
  theme,
  onChange,
}: {
  theme: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}): ReactElement => (
  <div data-testid="appearance-sheet" style={{ animation: "riseIn .4s ease" }}>
    <div style={{ textAlign: "center" }}>
      <div className="sheet-title">Appearance</div>
      <div className="sheet-lead">Choose how Keychain looks on this device.</div>
    </div>
    <div
      data-testid="appearance-options"
      className="panel"
      role="radiogroup"
      aria-label="Theme"
      style={{ marginTop: 22 }}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === theme;
        return (
          <button
            type="button"
            role="radio"
            data-testid={`appearance-${option.value}`}
            aria-checked={selected}
            key={option.value}
            className="row press"
            onClick={() => onChange(option.value)}
            style={{
              width: "100%",
              borderRight: "none",
              borderBottom: "none",
              borderLeft: "none",
              background: selected ? "#FFF8F2" : "transparent",
              textAlign: "left",
              ["--press" as string]: 0.99,
            }}
          >
            <span className="row-icon" style={{ background: "#F2EBE0" }}>
              {option.icon}
            </span>
            <span className="row-body">
              <span className="row-title" style={{ display: "block" }}>
                {option.label}
              </span>
              <span className="row-sub" style={{ display: "block" }}>
                {option.description}
              </span>
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                border: `2px solid ${selected ? "#E8502A" : "#CFC2AF"}`,
                borderRadius: "50%",
                background: selected ? "#E8502A" : "transparent",
                boxShadow: selected ? "inset 0 0 0 5px #FFF" : "none",
              }}
            />
          </button>
        );
      })}
    </div>
  </div>
);
