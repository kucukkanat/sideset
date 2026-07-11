import type { ReactElement } from "react";
import { ACTIVITY_GROUPS } from "../activity.ts";
import { ActivityRow } from "../components/ActivityRow.tsx";

export const Activity = (): ReactElement => (
  <div className="scr screen">
    <div style={{ padding: "8px 24px 18px" }}>
      <div className="hdr-title" style={{ marginTop: 0 }}>
        Activity
      </div>
      <div className="hdr-sub" style={{ marginTop: 2 }}>
        Everything that happened, in plain English
      </div>
    </div>
    {ACTIVITY_GROUPS.map((group) => (
      <div key={group.day} style={{ padding: "0 24px 20px" }}>
        <div className="sec-label">{group.day}</div>
        <div className="panel">
          {group.items.map((item) => (
            <ActivityRow key={item.title} item={item} />
          ))}
        </div>
      </div>
    ))}
  </div>
);
