export function resolveRequestId(value: string | null): string {
  return value && /^[A-Za-z0-9._-]{1,128}$/.test(value)
    ? value
    : crypto.randomUUID();
}
