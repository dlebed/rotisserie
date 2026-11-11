export type Route = { name: 'home' } | { name: 'session'; pk: string; id: string };

export function parseRoute(pathname: string): Route {
  const m = /^\/s\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  if (!m) return { name: 'home' };
  try { return { name: 'session', pk: decodeURIComponent(m[1] ?? ''), id: decodeURIComponent(m[2] ?? '') }; }
  catch { return { name: 'home' }; }
}

export const sessionPath = (pk: string, id: string): string =>
  `/s/${encodeURIComponent(pk)}/${encodeURIComponent(id)}`;

/** The server has already set the cookie from `?t=`; drop the token from the address bar. */
export function stripToken(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('t')) return;
  url.searchParams.delete('t');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
