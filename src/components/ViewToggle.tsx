import { VIEW_MODES, VIEW_MODE_LABEL, type GraveyardViewMode } from "@/lib/graveyard/view-mode";

export interface ViewToggleProps {
  view: GraveyardViewMode;
  onChange: (view: GraveyardViewMode) => void;
}

/** Two real buttons with aria-pressed: the graveyard scene or the plain list. */
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="graveyard-view-toggle" role="group" aria-label="View">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          className="graveyard-chip"
          aria-pressed={view === mode}
          onClick={() => onChange(mode)}
        >
          {view === mode ? (
            <span className="graveyard-chip-check" aria-hidden="true">
              {"\u2713"}
            </span>
          ) : null}
          {VIEW_MODE_LABEL[mode]}
        </button>
      ))}
    </div>
  );
}
