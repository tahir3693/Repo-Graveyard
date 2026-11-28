import {
  FILTERS,
  FILTER_LABEL,
  SORT_KEYS,
  SORT_LABEL,
  isSortKey,
  type Filter,
  type SortKey,
  type StatusCounts,
} from "@/lib/graveyard/view";

export interface GraveyardControlsProps {
  filter: Filter;
  sort: SortKey;
  counts: StatusCounts;
  onFilter: (filter: Filter) => void;
  onSort: (sort: SortKey) => void;
}

function countFor(counts: StatusCounts, filter: Filter): number {
  return filter === "all" ? counts.total : counts[filter];
}

/** Filter chips (real buttons with aria-pressed) and a sort select. */
export function GraveyardControls({
  filter,
  sort,
  counts,
  onFilter,
  onSort,
}: GraveyardControlsProps) {
  return (
    <div className="graveyard-controls">
      <div className="graveyard-chips" role="group" aria-label="Filter by status">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className="btn btn-secondary graveyard-chip"
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
          >
            {filter === value ? (
              <span className="graveyard-chip-check" aria-hidden="true">
                {"\u2713"}
              </span>
            ) : null}
            {FILTER_LABEL[value]}
            <span className="graveyard-chip-count">{countFor(counts, value)}</span>
          </button>
        ))}
      </div>
      <label className="graveyard-sort">
        <span className="graveyard-sort-label">Sort by</span>
        <select
          className="graveyard-select"
          value={sort}
          onChange={(event) => {
            const next = event.target.value;
            if (isSortKey(next)) onSort(next);
          }}
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
