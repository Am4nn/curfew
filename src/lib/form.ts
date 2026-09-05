/**
 * One text field out of a submitted form, as a string, or "" if it is not one.
 *
 * `FormData.get` returns `string | File | null`, and every action in this app
 * was reading it as `String(formData.get(key))`. A `File` posted where a string
 * was expected does not fail that: it stringifies to "[object File]" and travels
 * on as a perfectly ordinary-looking value. A missing key was worse, arriving as
 * the literal string "null".
 *
 * Anything that is not a string is nothing, which is the answer that makes the
 * validation the caller already does actually fire.
 */
export function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** The same, trimmed, which is what almost every caller wants. */
export function trimmed(formData: FormData, key: string): string {
  return field(formData, key).trim();
}
