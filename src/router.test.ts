import { describe, expect, it } from 'vitest';
import { hrefFor, parseHash } from './router';

describe('hash routes', () => {
  it('parses the main screens and subscription links', () => {
    expect(parseHash('')).toEqual({ name: 'list' });
    expect(parseHash('#/upcoming')).toEqual({ name: 'upcoming' });
    expect(parseHash('#/spend')).toEqual({ name: 'spend' });
    expect(parseHash('#/settings')).toEqual({ name: 'settings' });
    expect(parseHash('#/new')).toEqual({ name: 'edit', id: null });
    expect(parseHash('#/sub/example-harbour')).toEqual({ name: 'detail', id: 'example-harbour' });
    expect(parseHash(`#/edit/${encodeURIComponent('a b')}`)).toEqual({ name: 'edit', id: 'a b' });
    expect(parseHash('#/nope')).toEqual({ name: 'list' });
  });

  it('builds links that parse back to the same route', () => {
    const routes = [
      { name: 'list' as const },
      { name: 'upcoming' as const },
      { name: 'detail' as const, id: 'example-harbour' },
      { name: 'edit' as const, id: null },
    ];
    for (const route of routes) expect(parseHash(`#${hrefFor(route)}`)).toEqual(route);
  });
});
