import { describe, expect, it } from 'vitest';
import { createApi } from '../../web/src/api';

const apiWith = (status: number, body: unknown) => createApi({
  fetch: async () => new Response(body === undefined ? null : JSON.stringify(body), { status }),
  EventSource: class { onmessage = null; close() {} } as never,
});

describe('api errors', () => {
  it('carries status, code and message from the server body', async () => {
    const e = await apiWith(409, { error: 'unsupported', message: 'Update Rotisserie' }).getSession('pk', 'rt-1').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).toMatchObject({ status: 409, code: 'unsupported', message: 'Update Rotisserie' });
  });

  it('has a numeric status and no code when the body is empty', async () => {
    const e = await apiWith(404, undefined).getSession('pk', 'rt-1').catch((x: unknown) => x) as Error & { status: number; code?: string };
    expect(e.status).toBe(404);
    expect(e.code).toBeUndefined();
    expect(e.message).toContain('404');
  });
});
