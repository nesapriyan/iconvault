# Running IconVault on Netlify

Netlify publishes the Vite frontend from `client/dist` and routes `/api/*` to the API function in `client/netlify/functions`. The standalone server in `server/` remains available for the original local development workflow; Netlify uses the backend in `client/backend/`.

Application records use Netlify Database through Drizzle. The schema is in `client/db/schema.ts`; generated migrations are in `client/netlify/database/migrations/`. Netlify provisions the database and applies migrations during deployment. Do not run the standalone SQLite seed script for the Netlify deployment.

SVG files, version snapshots, and downloadable build packages use the site-level `iconvault-files` Netlify Blobs store. Temporary files are used only while generating fonts or archives and are removed when each function request completes. Existing local SQLite data and filesystem uploads are not automatically transferred. Export projects from the old running application and import those ZIPs after signing in to transfer them.

Accounts use Netlify Identity. Use **Sign in** in the navigation to create an account, confirm the email, and sign in. Project owners can manage their projects without an administrator role. To enable workspace-wide user management, open the project's Identity users in Netlify, select the intended administrator, and add the `admin` role. Sign out and back in after changing a role. The old demo accounts and password-free profile switching are not enabled on Netlify.

Uploads pass through a standard Netlify Function and are subject to its request and response size limits. Upload small batches of SVGs; split large ZIP or font imports into smaller uploads. The application limits each upload request, including its files and form fields, to 4 MB.

From `client/`, run `npm test` for migration and API integration checks, and `npm run typecheck` for frontend and backend type checks. The integration tests use an isolated PostgreSQL test instance and a mock file store; they do not write to the site's live database or storage.
