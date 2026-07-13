import { ActionButton } from "@shared/ui/ActionButton.tsx";
import { ScreenHeader } from "@shared/ui/ScreenHeader.tsx";
import { Power } from "lucide-react";
import { type ReactElement, useRef, useState } from "react";

interface DisabledFeatureProps {
  readonly title: string;
  readonly summary: string;
  readonly onEnable: () => void | Promise<void>;
}

export const DisabledFeature = ({
  title,
  summary,
  onEnable,
}: DisabledFeatureProps): ReactElement => {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const enable = async (): Promise<void> => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await onEnable();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <div data-testid="screen-disabled-feature" className="scr screen">
      <ScreenHeader title={title} subtitle="This feature is turned off" />
      <section className="app-page-content">
        <div className="panel feature-disabled-card">
          <div>
            <h2>{title}</h2>
            <p>{summary}</p>
          </div>
          <ActionButton
            data-testid="disabled-feature-enable"
            variant="primary"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void enable()}
          >
            <Power aria-hidden="true" size={16} />{" "}
            {pending ? `Downloading ${title}…` : "Enable and open"}
          </ActionButton>
          {pending && (
            <span className="feature-library-status" role="status" aria-live="polite">
              Downloading {title}…
            </span>
          )}
        </div>
      </section>
    </div>
  );
};
