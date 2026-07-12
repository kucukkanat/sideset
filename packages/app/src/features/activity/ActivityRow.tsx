import { type ActivityItem, formatActivityTime } from "@features/activity/activity.ts";
import { PROVIDER_META } from "@keychain/core";
import { ProviderIcon } from "@shared/ui/icons.tsx";
import type { ReactElement } from "react";

export const ActivityRow = ({ item }: { item: ActivityItem }): ReactElement => (
  <div data-testid={`activity-row-${item.id}`} className="row">
    <div
      className="row-icon"
      style={{
        background:
          item.icon.kind === "provider" ? PROVIDER_META[item.icon.provider].bg : item.icon.bg,
      }}
    >
      {item.icon.kind === "provider" ? (
        <ProviderIcon provider={item.icon.provider} size={20} />
      ) : (
        item.icon.emoji
      )}
    </div>
    <div data-testid={`activity-row-${item.id}-body`} className="row-body">
      <div data-testid={`activity-row-${item.id}-title`} className="row-title">
        {item.title}
      </div>
      <div data-testid={`activity-row-${item.id}-subtitle`} className="row-sub">
        {item.sub}
      </div>
    </div>
    <div data-testid={`activity-row-${item.id}-time`} className="row-time">
      {formatActivityTime(item.occurredAt)}
    </div>
  </div>
);
