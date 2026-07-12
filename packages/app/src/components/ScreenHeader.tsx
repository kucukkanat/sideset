import type { ReactElement, ReactNode } from "react";
import { HeaderActions } from "./ActionButton.tsx";

interface ScreenHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
}

export const ScreenHeader = ({ title, subtitle, actions }: ScreenHeaderProps): ReactElement => (
  <header className="app-screen-header">
    <div className="app-screen-header-copy">
      <h1 className="hdr-title">{title}</h1>
      {subtitle !== undefined && <p className="hdr-sub">{subtitle}</p>}
    </div>
    {actions !== undefined && <HeaderActions>{actions}</HeaderActions>}
  </header>
);
