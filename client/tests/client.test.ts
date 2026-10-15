import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client.js';
afterEach(() => vi.unstubAllGlobals());

describe('API error messages', () => {
  it('shows a useful message instead of displaying a returned HTML page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><h1>Not found</h1>', {
      status: 404, headers: { 'content-type': 'text/html' },
    })));
    await expect(api.getProjects()).rejects.toThrow('The API endpoint is unavailable');
  });
  it('preserves structured API validation errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      success: false, error: { message: 'Please check the submitted fields.' },
    }, { status: 422 })));
    await expect(api.createProject({ name: '' })).rejects.toThrow('Please check the submitted fields.');
  });
});
