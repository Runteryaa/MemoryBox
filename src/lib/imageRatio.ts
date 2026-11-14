/**
 * Photos carried over from before the app started recording their pixel size
 * still learn their shape on first decode. Remembering that ratio for the
 * session keeps every later card from reflowing as the same image appears in
 * the pile, the grid, and the sheet.
 */
const ratios = new Map<string, number>();

export function rememberImageRatio(uri: string, ratio: number): void {
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  ratios.set(uri, ratio);
}

export function cachedImageRatio(uri: string): number | null {
  return ratios.get(uri) ?? null;
}
