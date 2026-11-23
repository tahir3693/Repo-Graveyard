import { StatusIcon } from "@/components/Tombstone";
import { buildListRows, LIST_COLUMNS } from "@/lib/graveyard/list-rows";
import type { GraveEntry } from "@/lib/graveyard/tombstones";

export interface GraveyardListProps {
  entries: readonly GraveEntry[];
  /** Opens the detail drawer for one repo. */
  onSelect: (name: string) => void;
}

/**
 * The plain list: a real table with one row per repo. It is the equivalent of the tombstone
 * scene and shows every fact as text. The explicit roles keep the table semantics when the
 * phone layout stacks each row as a card.
 */
export function GraveyardList({ entries, onSelect }: GraveyardListProps) {
  const rows = buildListRows(entries);
  return (
    <div className="graveyard-list-wrap">
      <table className="graveyard-table" role="table" aria-label="Graveyard list">
        <thead role="rowgroup">
          <tr role="row">
            {LIST_COLUMNS.map((column) => (
              <th key={column} role="columnheader" scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => (
            <tr key={row.name} role="row" data-repo={row.name}>
              <th role="rowheader" scope="row" className="graveyard-table-repo">
                <button type="button" className="graveyard-table-open" onClick={() => onSelect(row.name)}>
                  {row.name}
                </button>
              </th>
              <td role="cell" data-label="Status">
                <span
                  className={`graveyard-table-status ${
                    row.status === "alive" ? "tombstone-status-alive" : "tombstone-status-failing"
                  }`}
                >
                  <StatusIcon status={row.status} />
                  {row.statusLabel}
                </span>
              </td>
              <td role="cell" data-label="Cause">
                {row.cause}
              </td>
              <td role="cell" data-label="Last commit">
                {row.lastCommit}
              </td>
              <td role="cell" data-label="Stars">
                {row.stars}
              </td>
              <td role="cell" data-label="CI">
                {row.ci}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
