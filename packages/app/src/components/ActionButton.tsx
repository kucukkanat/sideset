import { type ButtonHTMLAttributes, forwardRef, type ReactElement, type ReactNode } from "react";

type ActionButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ActionButtonVariant;
  readonly iconOnly?: boolean;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    { variant = "secondary", iconOnly = false, type = "button", className, children, ...props },
    ref,
  ): ReactElement => (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`app-action app-action-${variant}${iconOnly ? " app-action-icon" : ""}${className === undefined ? "" : ` ${className}`} press`}
    >
      {children}
    </button>
  ),
);

ActionButton.displayName = "ActionButton";

export const HeaderActions = ({ children }: { readonly children: ReactNode }): ReactElement => (
  <div className="app-header-actions">{children}</div>
);
