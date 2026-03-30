/** Split pasted text into non-empty lines (trimmed). Each line is treated as a single hostname or IP literal. */
export function splitImportLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
