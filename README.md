# Memties

Structured memory for human relationships. React/Vite frontend, Fastify API, MySQL and Drizzle.

Implemented: local authentication, private Personal vaults, nested groups, contact creation in multiple groups, recursive contact lists, contact details, standalone and multi-person entries, entry editing/movement, and paginated history filtered by context, date, participant, and text. The interface uses Lucide icons and UnoCSS Wind4 with variant groups, without custom CSS files.

Group owners can share with existing users by email, manage Owner/Editor/Viewer roles, and remove direct access. Access is inherited by descendants; a lower direct role does not reduce inherited access. Personal and all its descendants remain non-shareable. The backend protects the last owner, including concurrent removal attempts. Contact profiles can be edited only with write access to every group they belong to, and every destination group when changing their associations.

The whole interface is available in English and French through i18next/react-i18next, including errors, accessibility labels, the system Personal name, and date formatting. The first supported browser language is used initially (English fallback); no locale appears in the URL. App settings allow choosing the browser language or a fixed language, and a system/light/dark theme. Preferences persist in browser local storage and synchronize between tabs; user content is never translated automatically. Colors are defined through UnoCSS theme tokens and light/dark custom properties.

Reminders, MCP, SMTP and LDAP/SAML are still pending. Authentication identities remain separate from application users so other providers can be added later.

## Run locally

Requires Node.js 24+, pnpm 11, and a running MySQL 8.4 database with a dedicated database/user. The database user needs schema migration privileges.

```powershell
pnpm install
pnpm --dir backend install
pnpm --dir frontend install
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` with your database URL, then:

```powershell
pnpm --dir backend db:migrate
pnpm dev
```

Open the URL printed by Vite (currently http://localhost:5174). Vite proxies `/api` to port 3001. `APP_ORIGIN` must match the browser origin exactly; update it if you use another host or port. If the backend runs on another port, set `API_PROXY_TARGET` in the shell before starting Vite.

Create an account with a password of at least 12 characters. Create a root group, add nested subgroups, rename one through Settings, and refresh to confirm persistence. Log out and create a second account: the first account's groups must be absent. Subgroups inside Personal always remain private.

To validate contacts and entries:

1. Create two subgroups from the Subgroups tab, then add a contact attached to both. The parent group's People tab must list that contact once.
2. Open a contact and choose Add entry. The person and current group are preselected. Add another participant to create a meeting summary, or remove all participants for a standalone note.
3. Choose Personal as the entry's group to keep the entry private, independently of the contact's groups. General notes on the contact profile are visible wherever that profile is visible.
4. In the contact's history, filter by text, context, date range, or another participant. Context filters include descendants; All accessible groups shows the person's full authorized history.
5. Edit an entry and select another group. The form explains the destination's visibility and requires acknowledgement of the change. Backend checks both source and destination write rights.

To validate sharing and preferences, share a normal group with a second account as Viewer, then Editor. Check that subgroups inherit access and that revocation removes access unless another direct membership still grants it. A contact spanning a private group and a shared group must remain uneditable by a collaborator who cannot write to both. Open App settings in the header to switch language/theme, reload, and check that your preference and URL are preserved.

An entry link does not grant access to a contact profile. Each reader sees only the linked contacts they can access; editing an entry preserves links hidden from that reader. Entry source and creator cannot be supplied or changed by HTTP clients.

## Checks

```powershell
pnpm build
pnpm --dir frontend lint
pnpm --dir backend test
```

MySQL integration tests are skipped unless `TEST_DATABASE_URL` points to a dedicated database whose name ends in `_test`. They apply migrations and verify accounts, inherited roles, sharing/revocation, last-owner protection, contact modification rights across all groups, private subtrees, session expiration/revocation, recursive contact deduplication, independently private entries, hidden participants, search, pagination, and authorized entry moves. Do not point them at a development or production database.

```powershell
$env:TEST_DATABASE_URL='mysql://USER:PASSWORD@127.0.0.1:3306/memties_test'
pnpm --dir backend test
```

After schema changes, use `pnpm --dir backend db:generate` and commit the generated migration and metadata. Migrations are explicitly applied; the application does not modify the schema on startup.

## Deployment notes

Build with `pnpm build`, serve `frontend/dist` and proxy `/api` to the backend on the same HTTPS origin. Run `pnpm --dir backend start` with `NODE_ENV=production`, an HTTPS `APP_ORIGIN`, and `DATABASE_URL`. Run migrations before starting. Configure the reverse proxy to preserve the browser Origin header. Cookies are HttpOnly, SameSite=Lax and Secure in production; session tokens are stored hashed in MySQL and expire after seven days. Set `ALLOW_REGISTRATION=false` to close registration after creating accounts.

This milestone has no password recovery or email verification yet. Sharing grants access to an existing account without sending email. Authentication rate limiting is in-process; behind a proxy, attempts share its IP limit. The group service currently loads the group tree to resolve inherited permissions, suitable for the initial implementation but requiring optimization before large deployments. Group movement and deletion are not exposed yet.
