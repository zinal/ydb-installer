import type { TargetHost } from '@/api/client';

/** Parses `host`, `host:port`, or `[ipv6]:port`. If no port in the string, `explicitPort` is false and `port` is 22. */
export function parseHostPort(input: string): { host: string; port: number; explicitPort: boolean } {
  const s = input.trim();
  if (!s) return { host: '', port: 22, explicitPort: false };
  if (s.startsWith('[')) {
    const close = s.indexOf(']');
    if (close >= 0) {
      const rest = s.slice(close + 1);
      if (rest.startsWith(':')) {
        const portStr = rest.slice(1);
        if (/^\d+$/.test(portStr)) {
          const p = parseInt(portStr, 10);
          if (p >= 1 && p <= 65535) {
            return { host: s.slice(0, close + 1), port: p, explicitPort: true };
          }
        }
      }
      return { host: s.slice(0, close + 1), port: 22, explicitPort: false };
    }
  }
  const lastColon = s.lastIndexOf(':');
  if (lastColon > 0) {
    const hostPart = s.slice(0, lastColon);
    const portPart = s.slice(lastColon + 1);
    if (/^\d+$/.test(portPart)) {
      const p = parseInt(portPart, 10);
      if (p >= 1 && p <= 65535) {
        return { host: hostPart, port: p, explicitPort: true };
      }
    }
  }
  return { host: s, port: 22, explicitPort: false };
}

/** Builds a single address field for the form from API target (optional non-22 port appended as :port). */
export function formatAddressForForm(t: TargetHost): string {
  const a = (t.address ?? '').trim();
  const p = t.port && t.port > 0 && t.port !== 22 ? t.port : undefined;
  if (!p) return a;
  if (a.startsWith('[')) {
    const close = a.indexOf(']');
    if (close >= 0) {
      const rest = a.slice(close + 1);
      if (rest.startsWith(':')) {
        return a;
      }
      return `${a}:${p}`;
    }
  }
  if (/:\d+$/.test(a)) {
    return a;
  }
  return `${a}:${p}`;
}
