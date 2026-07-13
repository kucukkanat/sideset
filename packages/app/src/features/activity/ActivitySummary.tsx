import type { ReactElement } from "react";
import { ActivityRow } from "./ActivityRow.tsx";
import type { ActivityItem } from "./activity.ts";

interface ActivitySummaryProps {
  readonly items: readonly ActivityItem[];
  readonly onOpen: () => void;
}

export const ActivitySummary = ({ items, onOpen }: ActivitySummaryProps): ReactElement => (
  <section data-testid="home-recent-activity" className="wallet-section wallet-recent">
    <div className="wallet-section-heading">
      <div>
        <h2>Recent activity</h2>
        <p>Your latest wallet changes</p>
      </div>
      <button type="button" data-testid="home-see-all-activity" onClick={onOpen}>
        See all
      </button>
    </div>
    <div className="panel">
      {items.length > 0 ? (
        items.map((item) => <ActivityRow key={item.id} item={item} />)
      ) : (
        <div className="row-sub wallet-empty-activity">Your latest changes will appear here.</div>
      )}
    </div>
  </section>
);
