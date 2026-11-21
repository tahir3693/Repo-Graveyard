export function compareCodePoint(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  const length = Math.min(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i].codePointAt(0) ?? 0) - (right[i].codePointAt(0) ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  if (left.length === right.length) return 0;
  return left.length < right.length ? -1 : 1;
}

export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((x, y) => compareCodePoint(x.name, y.name));
}
