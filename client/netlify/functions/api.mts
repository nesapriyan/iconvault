import type { Config } from '@netlify/functions';
import { getUser } from '@netlify/identity';
import serverless from 'serverless-http';
import { withWorkspace } from '../../backend/config.js';
import { createApp } from '../../backend/app.js';
import { UserRepo } from '../../backend/db/repositories/userRepo.js';

export default async (req: Request) => withWorkspace(async () => {
  try {
    const identity = await getUser();
    const user = identity ? await UserRepo.sync(identity) : undefined;
    const body = ['GET', 'HEAD'].includes(req.method) ? null : Buffer.from(await req.arrayBuffer());
    if (body && body.length > 4 * 1024 * 1024) {
      return Response.json({ success: false, error: { message: 'Upload exceeds 4 MB. Please use a smaller file or batch.' } }, { status: 413 });
    }
    const url = new URL(req.url);
    const handler = serverless(createApp(user), { binary: ['application/zip', 'image/svg+xml', 'application/octet-stream'] });
    const result = await handler({
      httpMethod: req.method,
      path: url.pathname,
      headers: Object.fromEntries(req.headers),
      multiValueQueryStringParameters: Object.fromEntries([...new Set(url.searchParams.keys())].map(key => [key, url.searchParams.getAll(key)])),
      body: body?.toString('base64') || null,
      isBase64Encoded: true,
      requestContext: { identity: { sourceIp: '127.0.0.1' } },
    }, {}) as any;
    const headers = new Headers(result.headers);
    for (const [name, values] of Object.entries(result.multiValueHeaders || {})) {
      headers.delete(name);
      for (const value of values as string[]) headers.append(name, value);
    }
    return new Response(req.method === 'HEAD' || result.statusCode === 204 ? null :
      Buffer.from(result.body || '', result.isBase64Encoded ? 'base64' : 'utf8'), {
      status: result.statusCode, headers,
    });
  } catch {
    return Response.json({ success: false, error: { message: 'The API is temporarily unavailable. Please try again.' } }, { status: 503 });
  }
});
export const config: Config = { path: ['/api/*', '/storage/*'], preferStatic: false };
