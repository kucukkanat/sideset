import { ActionButton } from "@shared/ui/ActionButton.tsx";
import { ScreenHeader } from "@shared/ui/ScreenHeader.tsx";
import { Power, RefreshCw, RotateCw } from "lucide-react";
import type { ReactElement } from "react";

type VisibleReadiness = "preparing" | "failed" | "update-required" | "data-unavailable";

interface FeatureReadinessProps {
  readonly title: string;
  readonly status: VisibleReadiness;
  readonly onRetry?: () => void;
  readonly onReload?: () => void;
  readonly onDisable?: () => void;
}

const copyFor = (
  title: string,
  status: VisibleReadiness,
): { readonly subtitle: string; readonly heading: string; readonly body: string } => {
  switch (status) {
    case "preparing":
      return {
        subtitle: "Preparing offline support…",
        heading: `Downloading ${title}…`,
        body: "The feature will open after its complete offline asset set is available.",
      };
    case "failed":
      return {
        subtitle: "Download interrupted",
        heading: `${title} is not ready`,
        body: "The feature stayed enabled, but its assets could not be downloaded. Your wallet is unaffected.",
      };
    case "update-required":
      return {
        subtitle: "App update ready",
        heading: `Reload to update ${title}`,
        body: "A newer app version is already available. Reload once, then the feature can finish preparing.",
      };
    case "data-unavailable":
      return {
        subtitle: "Saved data could not be opened",
        heading: `${title} data is unavailable`,
        body: "The saved feature data was preserved exactly instead of being overwritten. The rest of your wallet remains available.",
      };
  }
};

export const FeatureReadiness = ({
  title,
  status,
  onRetry,
  onReload,
  onDisable,
}: FeatureReadinessProps): ReactElement => {
  const copy = copyFor(title, status);
  return (
    <div data-testid="screen-feature-readiness" className="scr screen">
      <ScreenHeader title={title} subtitle={copy.subtitle} />
      <section className="app-page-content">
        <div
          className="panel feature-disabled-card"
          role={status === "preparing" ? "status" : "alert"}
        >
          <div>
            <h2>{copy.heading}</h2>
            <p>{copy.body}</p>
          </div>
          {status !== "preparing" &&
            (onRetry !== undefined || onReload !== undefined || onDisable !== undefined) && (
              <div className="feature-library-actions">
                {status === "failed" && onRetry !== undefined && (
                  <ActionButton
                    data-testid="feature-readiness-retry"
                    variant="primary"
                    onClick={onRetry}
                  >
                    <RotateCw aria-hidden="true" size={16} /> Retry
                  </ActionButton>
                )}
                {status === "update-required" && onReload !== undefined && (
                  <ActionButton
                    data-testid="feature-readiness-reload"
                    variant="primary"
                    onClick={onReload}
                  >
                    <RefreshCw aria-hidden="true" size={16} /> Reload to update
                  </ActionButton>
                )}
                {onDisable !== undefined && (
                  <ActionButton
                    data-testid="feature-readiness-disable"
                    variant="secondary"
                    onClick={onDisable}
                  >
                    <Power aria-hidden="true" size={16} /> Turn off {title}
                  </ActionButton>
                )}
              </div>
            )}
        </div>
      </section>
    </div>
  );
};
