import { PROVIDER_META } from "@keychain/core";
import type { ReactElement } from "react";
import type { ActivityItem } from "../activity.ts";
import { ProviderIcon } from "../icons.tsx";

export const ActivityRow = ({ item }: { item: ActivityItem }): ReactElement => (
  <div className="row">
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
    <div className="row-body">
      <div className="row-title">{item.title}</div>
      <div className="row-sub">{item.sub}</div>
    </div>
    <div className="row-time">{item.time}</div>
  </div>
);
