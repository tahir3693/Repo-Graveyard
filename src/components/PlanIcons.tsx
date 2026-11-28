import type { Decision, EffortLevel } from "@/lib/resurrection/plan";

/**
 * Small shapes for the plan. All are decorative (aria-hidden): every one sits next to
 * a word that says the same thing, so nothing relies on shape or color alone.
 */
function Icon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg className={`plan-icon${className ? ` ${className}` : ""}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Revive: an arrow rising. Archive: a closed box. Merge: two branches joining. */
export function VerdictIcon({ decision }: { decision: Decision }) {
  switch (decision) {
    case "revive":
      return (
        <Icon>
          <path d="M8 1 14.5 8H10v7H6V8H1.5Z" />
        </Icon>
      );
    case "archive":
      return (
        <Icon>
          <path fillRule="evenodd" d="M1 2h14v4H1ZM2 7h12v8H2Zm4 2v2h4V9Z" />
        </Icon>
      );
    case "merge":
      return (
        <Icon>
          <path d="M2 1h3v4c0 1.7 1 2.5 3 2.5S11 6.7 11 5V1h3v4c0 3-2 5-4.5 5.6V15h-3v-4.4C4 10 2 8 2 5Z" />
        </Icon>
      );
  }
}

export function ClockIcon() {
  return (
    <Icon>
      <path
        fillRule="evenodd"
        d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3Zm-.75 2v3.7l2.6 1.5.75-1.3-1.85-1.1V5Z"
      />
    </Icon>
  );
}

export function CheckIcon() {
  return (
    <Icon className="plan-icon-win">
      <path d="M6.5 11.6 3.2 8.3 1.8 9.7l4.7 4.7 8-8L13.1 5Z" />
    </Icon>
  );
}

/** A triangle with an exclamation mark: the caution shape for risks. */
export function CautionIcon() {
  return (
    <Icon className="plan-icon-risk">
      <path fillRule="evenodd" d="M8 1 15.5 14.5h-15ZM7.25 6v4h1.5V6Zm0 5v1.5h1.5V11Z" />
    </Icon>
  );
}

export function TaskBoxIcon({ done }: { done: boolean }) {
  return done ? (
    <Icon>
      <path fillRule="evenodd" d="M2 2h12v12H2Zm4.5 9.6L12 6.1 10.9 5 6.5 9.4 5 7.9 3.9 9Z" />
    </Icon>
  ) : (
    <Icon>
      <path fillRule="evenodd" d="M2 2h12v12H2Zm1.5 1.5v9h9v-9Z" />
    </Icon>
  );
}

/** Three bars, filled up to the level: one for low, two for medium, three for high. */
export function LevelIcon({ level }: { level: EffortLevel }) {
  const filled = level === "low" ? 1 : level === "medium" ? 2 : 3;
  return (
    <svg className="plan-icon plan-icon-level" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1 + i * 5}
          y={11 - i * 4}
          width="4"
          height={4 + i * 4}
          className={i < filled ? undefined : "plan-bar-off"}
        />
      ))}
    </svg>
  );
}
