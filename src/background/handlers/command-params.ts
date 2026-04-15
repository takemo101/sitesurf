export function requireNumber(params: Record<string, unknown>, key: string): number {
  const val = params[key];
  if (typeof val !== "number") throw new Error(`${key} required`);
  return val;
}

export function requireString(params: Record<string, unknown>, key: string): string {
  const val = params[key];
  if (typeof val !== "string" || !val) throw new Error(`${key} required`);
  return val;
}
