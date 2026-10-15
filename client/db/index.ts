import { drizzle } from 'drizzle-orm/netlify-db';
import * as schema from './schema.js';
function connect() { return drizzle({ schema }); }
let client: ReturnType<typeof connect> | undefined;
export function database() { return client ??= connect(); }
