export function parseSince(url: URL) {
  const raw = url.searchParams.get('since') ?? '0';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false as const, error: { field: 'since', reason: 'since 必须是大于或等于 0 的整数' } };
  }
  return { ok: true as const, value };
}
