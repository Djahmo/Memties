# Memties

Structured memory for human relationships. React/Vite frontend, Fastify API, MySQL and Drizzle.

Implemented: local authentication, private Personal vaults, nested groups, contact creation in multiple groups, recursive contact lists, contact details, standalone and multi-person entries, entry editing/movement, and paginated history filtered by context, date, participant, and text. The interface uses Lucide icons and UnoCSS Wind4 with variant groups, without custom CSS files.

Group owners can share with existing users by email, manage Owner/Editor/Viewer roles, and remove direct access. Access is inherited by descendants; a lower direct role does not reduce inherited access. Personal and all its descendants remain non-shareable. The backend protects the last owner, including concurrent removal attempts. Contact profiles can be edited only with write access to every group they belong to, and every destination group when changing their associations.

The whole interface is available in English and French through i18next/react-i18next, including errors, accessibility labels, the system Personal name, and date formatting. The first supported browser language is used initially (English fallback); no locale appears in the URL. App settings allow choosing the browser language or a fixed language, and a system/light/dark theme. Preferences persist in browser local storage and synchronize between tabs; user content is never translated automatically. Colors are defined through UnoCSS theme tokens and light/dark custom properties.

Reminders are attached to entries and inherit their current visibility. They can be created with a new entry or from its history, edited, completed and reopened. Group views include recursive reminders; contact views include reminders on their accessible entries. Optional email notifications go only to the creator, provided they still have access. Emails contain a generic sign-in link, never contact names, titles or note content.

MCP is available at `/api/mcp` over stateless Streamable HTTP using the official SDK. In App settings, create a named, expiring token with read-only or read/write access. Copy it once and configure your MCP client with this endpoint and an `Authorization: Bearer <token>` header. Tokens are hashed in the database, can be revoked immediately, and never grant more rights than their user. They include the user's Personal data: only give them to a trusted assistant. Read/write tokens permit content creation, group/subgroup creation and reminder completion, not group permission administration. The create_group tool requires an explicit parentId (null for a root group); subgroups require ownership of their parent and inherit its access permissions. ChatGPT developer-mode connections can use OAuth with automatic client registration (leave client ID and secret empty). Authorization uses the existing Memties login and explicit consent, with PKCE S256 and single-use codes. OAuth access lasts 30 days; reconnect after expiry. Revoke access in App settings under tokens. The default scope is memties:read; clients can request memties:write for write access.

Tools: `list_groups`, `create_group`, `search_people`, `get_person`, `create_person`, `get_entry`, `search_entries`, `create_entry`, `create_reminder`, `list_reminders`, `complete_reminder`. Lists support pagination. Entry creation requires an explicit group ID and records `source=mcp`; HTTP and MCP call the same services. Tool instructions require asking the user when the destination creates a meaningful privacy ambiguity.

LDAP and SAML are optional and disabled without configuration. They use the same internal users and Personal vaults as local authentication. First sign-in creates an account for a new email. Existing emails are never automatically merged: sign in to the existing account and link the identity in App settings. Directory login can provision accounts even when public local registration is disabled. Configure which users may access the directory search base or SAML application at your identity provider.

## Run locally

Logs use compact text by default, with startup messages and HTTP warnings/errors. Set `LOG_LEVEL=debug` in `backend/.env` to also log successful requests (one line per completed request), or `LOG_FORMAT=json` for a structured log collector. Error stack traces remain available. With systemd, use `journalctl -u <service> -f -o cat` for live logs, or add `--no-pager` when inspecting history to avoid pager truncation.

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

After schema changes, use `pnpm --dir backend db:generate` and commit the generated migration and metadata. Outside Docker Compose, apply migrations explicitly. The Compose startup command applies pending migrations before launching the application.

## Deployment notes

Build with `pnpm build`, serve `frontend/dist` and proxy `/api` to the backend on the same HTTPS origin. Run `pnpm --dir backend start` with `NODE_ENV=production`, an HTTPS `APP_ORIGIN`, and `DATABASE_URL`. Run migrations before starting. Configure the reverse proxy to preserve the browser Origin header. Cookies are HttpOnly, SameSite=Lax and Secure in production; session tokens are stored hashed in MySQL and expire after seven days. Set `ALLOW_REGISTRATION=false` to close registration after creating accounts.

Sharing grants access to an existing account without sending email. Group settings allow moving a group and its descendants, with an explicit visibility acknowledgement, and deleting empty groups only. Groups cannot cross the Personal vault boundary. Detaching a normal subgroup to the root grants its moving user direct ownership; existing direct memberships remain. Contacts, entries and subgroups block deletion.

Authentication rate limiting is in-process; behind a proxy, attempts share its IP limit. Authorization currently loads the group tree, suitable for V1 but requiring optimization before large deployments. Local password recovery, email verification, SAML single logout, calendar synchronization and billing are not implemented. Signing out revokes the current Memties session; it does not sign out of the identity provider. Existing external-provider sessions remain valid until logout or expiry, even if the external account is subsequently disabled.

### SMTP and reminders

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, optionally `SMTP_USER`/`SMTP_PASSWORD`, and `SMTP_SECURE=true` for implicit TLS (usually port 465). Otherwise STARTTLS is required (usually port 587). Users explicitly choose email notification on each reminder. The worker checks once per minute and retries delivery failures after five minutes. A crash after SMTP acceptance but before the database commit can produce a duplicate notification. The application must remain running to deliver reminders.

### LDAP and SAML

See `backend/.env.example` for all integration variables. LDAP requires LDAPS with certificate verification, a search account, a search base, and a stable identity attribute (`entryUUID`, or `objectGUID` for Active Directory). Configure `LDAP_LOGIN_ATTRIBUTE=sAMAccountName` for AD. A successful user bind is required; the directory password is never stored. Custom certificate authorities can be configured with Node's `NODE_EXTRA_CA_CERTS`.

SAML requires an HTTPS app origin, the IdP issuer, and its signing certificate (PEM). Register `/api/auth/saml/metadata` as the entity ID/metadata URL and `/api/auth/saml/callback` as the HTTP-POST assertion consumer service. Require a persistent NameID, signed responses and signed assertions, and map the email/display name attributes. AuthnRequests are unsigned by default; optionally set both `SAML_SP_KEY_FILE` and `SAML_SP_CERT_FILE` to sign them with SHA-256. Issuer, audience, request correlation and assertion lifetime are always validated. Browser-bound flows and request IDs are stored in MySQL and consumed under a lock to prevent replay. IdP-initiated sign-in is intentionally disabled. Mount certificate/key files separately; never include them in an image or commit them.

### Docker

Set `APP_PORT` in the root `.env` or Portainer stack variables to change the published host port (default: `3001`). For example, `APP_PORT=3002` publishes the application at `127.0.0.1:3002`; point the host reverse proxy there. The container continues to listen on port `3001`.

Optional `http_proxy` and `https_proxy` variables can be set in the root `.env` or in Portainer's stack environment variables. Compose forwards them to the build and application container; Node's environment proxy support is enabled. `no_proxy` defaults to `localhost,127.0.0.1,::1,db` so local healthchecks bypass the proxy. No proxy address is stored in the image or source. These settings do not configure the Docker daemon's image downloads or Portainer's Git access; configure their proxies separately if required.

The image serves both the built frontend and the API. Copy the root `.env.example` to `.env` (or enter its Docker settings in Portainer) and set a strong `MYSQL_PASSWORD` and the matching `DOCKER_DATABASE_URL` (`mysql://memties:URL_ENCODED_PASSWORD@db:3306/memties`). `backend/.env` remains dedicated to local development.

Create `/opt/memties/.env` on the Docker server using `deploy/app.env.example`, and set the public HTTPS `APP_ORIGIN` there. Add application settings such as SMTP, LDAP, SAML, VAPID and `ALLOW_REGISTRATION` to this file. `APP_ENV_FILE` can select a different absolute server path. The file must exist before deployment and be readable by the container's `node` user (UID 1000); on Linux, for example, use owner UID 1000 and mode 600. Compose mounts it read-only at `/app/backend/.env`; it survives container replacement and Git updates. Edit it on the server and restart the application to reload it. If your editor replaces the file instead of updating it in place, recreate the application container to refresh the bind mount. Back up this file alongside the database. Docker settings explicitly passed in `environment` take precedence over its contents. Then:

```sh
docker compose build
docker compose up -d --wait
```

For SAML, put the IdP signing certificate at `/opt/memties/certificate/saml-idp.pem` on the Docker server and set `SAML_IDP_CERT_FILE=./certificate/saml-idp.pem` in the application environment file. Compose mounts this directory read-only at `/app/backend/certificate`, creating an empty host directory if needed. It persists across rebuilds and container replacements. Set `APP_CERTIFICATE_DIR` in the root `.env` or Portainer stack variables to use another host directory. Files must be readable by UID 1000. Back up the host certificate directory alongside the application environment file and database; persistence is not an automatic backup.

Place your HTTPS reverse proxy in front of `127.0.0.1:3001` (or `APP_PORT`), preserving the Origin header. Back up the database before updates. Compose waits for MySQL to be healthy, applies pending migrations, then starts the application only if migration succeeds. Already applied migrations are tracked by Drizzle. Keep a single application instance with this startup workflow to avoid concurrent migrations. No email or identity provider is configured automatically.

The database healthcheck verifies an authenticated query against the application database; the application healthcheck probes `/api/health` (HTTP availability, not database readiness). The runtime image includes production dependencies, compiled code and migrations only. Changing `MYSQL_PASSWORD` in `.env` does not change the password of a user in an existing MySQL volume; update that database account explicitly before updating the connection settings.

### Push notifications for reminders

Run `pnpm --dir backend db:migrate`. In `backend/`, generate a VAPID key pair with `pnpm exec web-push generate-vapid-keys --json`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:` contact or HTTPS URL) in the backend environment. Keep the private key secret and retain the same pair across deployments. Restart the backend after configuration.

In App settings, enable push on each device and accept the browser prompt. Select push when creating or editing a reminder. HTTPS is required (localhost works for development). On iOS/iPadOS 16.4+, install Memties on the Home Screen and launch it there before enabling notifications. Signing out disables push on that device; enable it again after signing in. Email and push can be used independently or together.

The backend checks every minute, sends only to the creator's registered devices while they retain access, and retries temporary failures after five minutes. Notifications contain generic text only. Expired subscriptions are removed. Retry after partial delivery or a process crash may deliver duplicates; notification tags replace the same reminder where supported. Keep the backend running. OS/browser settings can delay or prevent delivery; force-quitting a browser may prevent push. Push provider endpoints are restricted to Google, Mozilla, Apple and Windows services.

### OAuth deployment

Apply the new database migration with `pnpm --dir backend db:migrate`, deploy the backend and frontend, and restart the service. Configure ChatGPT with OAuth and `https://<your-host>/api/mcp`; leave optional client credentials empty.

The reverse proxy must forward both `/api/` and `/.well-known/` to the backend, preserving their paths. In particular, `/.well-known/oauth-authorization-server` must return backend JSON rather than frontend HTML. For nginx on the current port:

```nginx
location ^~ /.well-known/ {
    proxy_pass http://127.0.0.1:4010;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`APP_ORIGIN` must match the public HTTPS origin. Existing Bearer tokens remain supported.
