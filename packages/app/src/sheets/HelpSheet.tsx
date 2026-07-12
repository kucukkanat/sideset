import type { ReactElement } from "react";

const HELP: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: "What is a card?",
    body: "A card is a separate profile for one part of your life. You can switch cards whenever you like.",
  },
  {
    title: "Where is my information saved?",
    body: "This preview keeps your information on this device. Export a backup before removing the app or clearing its data.",
  },
  {
    title: "How do I add someone?",
    body: "Open People, tap the plus button, then import the profile they shared with you.",
  },
];

export const HelpSheet = (): ReactElement => (
  <div data-testid="help-sheet" style={{ animation: "riseIn .4s ease" }}>
    <div style={{ textAlign: "center" }}>
      <div className="sheet-title">Help & support</div>
      <div className="sheet-lead">Quick answers about this preview.</div>
    </div>
    <div className="panel" style={{ marginTop: 22 }}>
      {HELP.map((item) => (
        <section
          data-testid={`help-item-${item.title.toLowerCase().replaceAll(" ", "-")}`}
          className="row"
          key={item.title}
          style={{ alignItems: "flex-start" }}
        >
          <div className="row-icon" style={{ background: "#EFEAF7" }}>
            ?
          </div>
          <div className="row-body">
            <h2 className="row-title">{item.title}</h2>
            <p className="row-sub" style={{ marginTop: 5, lineHeight: 1.5 }}>
              {item.body}
            </p>
          </div>
        </section>
      ))}
    </div>
  </div>
);
