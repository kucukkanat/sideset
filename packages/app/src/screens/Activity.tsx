import type { ReactElement } from "react";
import { type ActivityItem, groupActivity } from "../activity.ts";
import { ActivityRow } from "../components/ActivityRow.tsx";

export const Activity = ({ items }: { items: readonly ActivityItem[] }): ReactElement => {
  const groups = groupActivity(items);
  return (
    <div data-testid="screen-activity" className="scr screen">
      <div style={{ padding: "8px 24px 18px" }}>
        <div className="hdr-title" style={{ marginTop: 0 }}>
          Activity
        </div>
        <div className="hdr-sub" style={{ marginTop: 2 }}>
          Everything that happened, in plain English
        </div>
      </div>
      {groups.length === 0 && (
        <div style={{ padding: "0 24px 20px" }}>
          <div data-testid="activity-empty" className="panel">
            <div className="row-sub" style={{ padding: 22, textAlign: "center" }}>
              Your changes will appear here.
            </div>
          </div>
        </div>
      )}
      {groups.map((group) => (
        <div
          data-testid={`activity-group-${group.day}`}
          key={group.day}
          style={{ padding: "0 24px 20px" }}
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
