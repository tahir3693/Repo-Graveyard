export type InFlightSet = {
  acquire(key: string): boolean;
  release(key: string): void;
};

/** Tracks keys with a request in progress. Acquire returns false when the key is busy. */
export function createInFlightSet(): InFlightSet {
  const active = new Set<string>();
  return {
    acquire(key) {
      if (active.has(key)) return false;
      active.add(key);
      return true;
    },
    release(key) {
      active.delete(key);
    },
  };
}
