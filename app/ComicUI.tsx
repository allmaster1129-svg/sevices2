import type { ReactNode } from "react";

type Accent = "blue" | "yellow" | "pink" | "mint";
type Mood = "cheer" | "think" | "explain" | "celebrate";
type Prop = "laptop" | "note" | "checklist";

export function ComicBubble({
  children,
  accent = "yellow",
  className = "",
}: {
  children: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div className={`comic-bubble ${accent} ${className}`.trim()}>
      {children}
    </div>
  );
}

export function PaperCaption({
  children,
  accent = "blue",
}: {
  children: ReactNode;
  accent?: Accent;
}) {
  return <span className={`paper-caption ${accent}`}>{children}</span>;
}

export function OfficeCharacter({
  mood = "cheer",
  prop = "note",
  compact = false,
}: {
  mood?: Mood;
  prop?: Prop;
  compact?: boolean;
}) {
  return (
    <div
      className={`office-character ${mood} ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <div className="character-head">
        <i className="character-hair" />
        <i className="character-eye left" />
        <i className="character-eye right" />
        <i className="character-mouth" />
      </div>
      <div className="character-body">
        <i className="character-collar left" />
        <i className="character-collar right" />
      </div>
      <i className="character-arm left" />
      <i className="character-arm right" />
      <div className={`character-prop ${prop}`}>
        {prop === "laptop" ? "BAEM" : prop === "checklist" ? "✓ ✓ ✓" : "NOTE"}
      </div>
    </div>
  );
}

export function ComicCue({
  children,
  label,
  accent = "yellow",
  mood = "explain",
  prop = "note",
}: {
  children: ReactNode;
  label?: string;
  accent?: Accent;
  mood?: Mood;
  prop?: Prop;
}) {
  return (
    <aside className={`comic-cue ${accent}`}>
      <OfficeCharacter mood={mood} prop={prop} compact />
      <ComicBubble accent={accent}>
        {label && <b>{label}</b>}
        <span>{children}</span>
      </ComicBubble>
    </aside>
  );
}

export function TutorialStep({
  number,
  title,
  children,
  accent,
}: {
  number: string;
  title: string;
  children: ReactNode;
  accent: Accent;
}) {
  return (
    <article className={`tutorial-step ${accent}`}>
      <PaperCaption accent={accent}>STEP {number}</PaperCaption>
      <div className="tutorial-scene">
        <OfficeCharacter
          compact
          mood={number === "04" ? "celebrate" : "explain"}
          prop={number === "04" ? "checklist" : number === "01" ? "laptop" : "note"}
        />
        <span className="tutorial-action" aria-hidden="true">
          {number === "01" ? "→" : number === "04" ? "✓" : "···"}
        </span>
      </div>
      <div className="tutorial-copy">
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </article>
  );
}
