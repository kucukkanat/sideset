import { ScreenHeader } from "@shared/ui/ScreenHeader.tsx";
import type { ReactElement } from "react";
import { ActivityRow } from "./ActivityRow.tsx";
import { type ActivityItem, groupActivity } from "./activity.ts";

export const Activity = ({ items }: { items: readonly ActivityItem[] }): ReactElement => {
  const groups = groupActivity(items);
  return (
    <div data-testid="screen-activity" className="scr screen">
      <ScreenHeader title="Activity" subtitle="Everything that happened, in plain English" />
      {groups.length === 0 && (
        <div className="app-page-content">
          <div data-testid="activity-empty" className="panel">
            <div className="row-sub activity-empty-copy">Your changes will appear here.</div>
          </div>
        </div>
      )}
      {groups.map((group) => (
        <div
          data-testid={`activity-group-${group.day}`}
          key={group.day}
          className="app-page-content activity-group"
        >
          <div data-testid={`activity-group-${group.day}-label`} className="sec-label">
            {group.day}
          </div>
          <div data-testid={`activity-group-${group.day}-list`} className="panel">
            {group.items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
