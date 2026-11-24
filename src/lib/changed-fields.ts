// What an edit actually changes. The manager-api update accepts only the fields that are sent, and a field
// that did not change is better not sent: it avoids a uniqueness check of a record against itself.
export function changedFields<T extends Record<string, unknown>>(original: T, next: Partial<T>): Partial<T> {
  const changed: Partial<T> = {};

  for (const key of Object.keys(next) as (keyof T)[]) {
    if (next[key] !== original[key]) changed[key] = next[key];
  }

  return changed;
}
