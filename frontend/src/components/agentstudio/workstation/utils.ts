export function nextId(items: { id: string }[]): string {
  const max = items.reduce((m, i) => Math.max(m, Number(i.id)), 0);
  return String(max + 1);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
