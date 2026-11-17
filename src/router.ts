export type Route =
  | { name: 'list' }
  | { name: 'upcoming' }
  | { name: 'spend' }
  | { name: 'settings' }
  | { name: 'detail'; id: string }
  | { name: 'edit'; id: string | null };

export function parseHash(hash: string): Route {
  const path = decodeURIComponent(hash.replace(/^#/, '') || '/');
  if (path === '/' || path === '/subs') return { name: 'list' };
  if (path === '/upcoming') return { name: 'upcoming' };
  if (path === '/spend') return { name: 'spend' };
  if (path === '/settings') return { name: 'settings' };
  if (path === '/new') return { name: 'edit', id: null };
  const detail = /^\/sub\/([^/]+)$/.exec(path);
  if (detail?.[1]) return { name: 'detail', id: detail[1] };
  const edit = /^\/edit\/([^/]+)$/.exec(path);
  if (edit?.[1]) return { name: 'edit', id: edit[1] };
  return { name: 'list' };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'list':
      return '/';
    case 'upcoming':
      return '/upcoming';
    case 'spend':
      return '/spend';
    case 'settings':
      return '/settings';
    case 'detail':
      return `/sub/${encodeURIComponent(route.id)}`;
    case 'edit':
      return route.id ? `/edit/${encodeURIComponent(route.id)}` : '/new';
  }
}

export function navigate(route: Route): void {
  const next = `#${hrefFor(route)}`;
  if (window.location.hash === next || (route.name === 'list' && (window.location.hash === '' || window.location.hash === '#'))) {
    if (window.location.hash !== next && route.name === 'list') window.location.hash = '/';
    return;
  }
  window.location.hash = hrefFor(route);
}
