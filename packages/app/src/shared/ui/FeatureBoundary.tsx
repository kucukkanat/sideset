import { Component, type ErrorInfo, type ReactElement, type ReactNode, Suspense } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly feature: string;
  readonly onDisable?: () => void;
  readonly onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

class FeatureErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error("The feature could not be loaded") };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`${this.props.feature} feature failed`, error, info.componentStack);
    this.props.onError?.(error);
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <div className="scr screen" data-testid="feature-error" role="alert">
        <div className="app-page-content app-page-stack">
          <h1>{this.props.feature} is unavailable</h1>
          <p>The feature did not load. Your wallet data is still available.</p>
          <button
            type="button"
            className="btn-light press"
            data-testid="feature-retry"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
          {this.props.onDisable !== undefined && (
            <button
              type="button"
              className="btn-light press"
              data-testid="feature-disable"
              onClick={this.props.onDisable}
            >
              Turn off {this.props.feature}
            </button>
          )}
        </div>
      </div>
    );
  }
}

const LoadingFeature = ({ feature }: { readonly feature: string }): ReactElement => (
  <div className="scr screen" data-testid="feature-loading" role="status" aria-live="polite">
    <div className="app-page-content">Loading {feature}…</div>
  </div>
);

export const FeatureBoundary = ({
  children,
  feature,
  onDisable,
  onError,
}: ErrorBoundaryProps): ReactElement => (
  <FeatureErrorBoundary
    feature={feature}
    {...(onDisable === undefined ? {} : { onDisable })}
    {...(onError === undefined ? {} : { onError })}
  >
    <Suspense fallback={<LoadingFeature feature={feature} />}>{children}</Suspense>
  </FeatureErrorBoundary>
);
