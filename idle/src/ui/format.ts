export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** 2 h 14 m, 6 m 05 s, 42 s. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 86400) return `${Math.floor(s / 86400)} d ${Math.floor(s % 86400 / 3600)} h`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} m`;
  if (s >= 60) return `${Math.floor(s / 60)} m ${String(s % 60).padStart(2, '0')} s`;
  return `${s} s`;
}

export function ago(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 60) return 'just now';
  return `${duration(s).split(' ').slice(0, 2).join(' ')} ago`;
}

export const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
