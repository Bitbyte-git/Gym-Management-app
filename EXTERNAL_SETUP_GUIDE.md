# PulseFit Gym Management: External Setup Guide

This guide covers the accounts, services, credentials, and machine setup that live outside the application code. It is written for a first-time setup.

> **Project-specific note:** Your IDE shows `Dockerfile.client` as an open project file, but I could not read the repository contents because the workspace command runner is unavailable. The guide therefore still needs a final comparison against your `docker-compose.yml`, Dockerfiles, `.github/workflows/`, and environment loader before following commands literally. Do not paste secrets into source code or commit `.env` files.

## 1. What you are setting up

For local development, Docker can run MongoDB and Redis on your computer. Your React app and Express API can run either in Docker too or directly from your terminal, depending on your Compose setup.

For production, you need:

1. A GitHub repository to store code and run CI/CD.
2. A server or cloud container platform to run the application.
3. MongoDB hosting (MongoDB Atlas is a straightforward managed option).
4. Redis hosting (a managed Redis provider, or Redis on the application host for a small deployment).
5. A domain name and HTTPS for a public deployment.
6. GitHub Actions secrets for production credentials.

Docker is the packaging and local service tool. GitHub Actions runs your automated build/deploy steps. MongoDB stores application data. Redis is a fast temporary/cache/session store. They are separate things and each needs its own configuration.

## 2. Install the local tools

On Windows, install these first:

1. **Git** — download from [git-scm.com](https://git-scm.com/download/win). During installation, the default options are fine for most beginners.
2. **Node.js LTS** — download from [nodejs.org](https://nodejs.org/). Choose the LTS version. Node includes npm.
3. **Docker Desktop** — download from [Docker Desktop](https://www.docker.com/products/docker-desktop/). If asked, enable the WSL 2 backend and restart Windows.
4. **A code editor** — Visual Studio Code is a common option, but not required.
5. **A GitHub account** — needed if the source repository is hosted on GitHub.

Open PowerShell and check that the tools are available:

```powershell
git --version
node --version
npm --version
docker --version
docker compose version
```

If a command is not found, close and reopen PowerShell after installing the tool. Docker Desktop must be running before Docker commands work.

## 3. Get the project and create local environment files

If you already have the project folder, open PowerShell in that folder. Otherwise clone your GitHub repository (replace the example URL):

```powershell
git clone https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

Look for `.env.example`, `.env.sample`, or README environment instructions. Copy the example to the required local environment file; do not rename or invent files until you check what the code reads.

Examples (use only the one matching the repository):

```powershell
Copy-Item .env.example .env
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env.local
```

If no example exists, use the variable names required by the app. Your supplied notes mention these examples:

```dotenv
# Frontend-visible value. Vite variables are bundled into the browser, so this must not be a secret.
VITE_API_URL=http://localhost:5000/api

# Server-side values belong in server/.env, not in client/.env.local.
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pulsefit
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-a-long-random-secret
MANTRA_RD_SERVICE_URL=http://localhost:10000
MANTRA_DEVICE_ID=MFS110
```

These are illustrative. Use the exact names from your code. The notes say `MANTRA_RD_SERVICE_URL` and `MANTRA_DEVICE_ID`; Mantra RD Service is a Windows machine/device integration and generally should not be exposed as a public internet service.

Create a strong local JWT secret without sharing it:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the result into the server environment file. Keep `.env`, `server/.env`, and `client/.env.local` out of Git. Check `.gitignore`; if these files are not ignored, add them before entering real credentials.

## 4. Start local MongoDB and Redis with Docker

First inspect the project for `compose.yaml`, `docker-compose.yml`, or `docker-compose.yaml`. If it exists, read it to see service names and ports. From the project root, start its services:

```powershell
docker compose up -d
```

Check that containers are running:

```powershell
docker compose ps
docker compose logs --tail=100
```

If Compose starts MongoDB and Redis, configure the API with the addresses appropriate to where the API runs:

- API running directly on Windows: usually `mongodb://localhost:27017/...` and `redis://localhost:6379`.
- API running inside the Compose network: use the **Compose service names**, such as `mongodb://mongo:27017/...` and `redis://redis:6379`, if the services are named `mongo` and `redis`.

Inside a container, `localhost` means that same container. It does not mean your Windows host or another container. This is a common cause of connection errors.

If the repository does not define MongoDB/Redis in Compose, do not assume the `up` command installs them. Either add the intended services to Compose or install/run them separately. Prefer the project’s existing Compose file and documented service names.

Useful commands:

```powershell
docker compose logs -f            # Follow service logs; Ctrl+C stops viewing logs
docker compose restart            # Restart services
docker compose down               # Stop and remove containers; named volumes usually remain
```

Avoid `docker compose down -v` unless you intend to delete local database volumes and their data.

## 5. Run the application locally

Install dependencies in the folders that contain `package.json`. Check the repository’s scripts first; commands can differ by project.

```powershell
npm install
```

If the app uses separate client/server packages:

```powershell
cd server
npm install
```

In a second PowerShell window:

```powershell
cd client
npm install
```

Start the backend using its available script (the architecture notes describe `npm run server` at the root, but verify `package.json`):

```powershell
npm run server
```

Start the frontend in its folder using the Vite script:

```powershell
npm run dev
```

Open the local URL printed by Vite, commonly `http://localhost:5173`. The backend is commonly `http://localhost:5000`. Check the API health endpoint if your app defines one. Confirm the frontend’s `VITE_API_URL` points at the backend. A browser cannot use a server-only hostname such as `mongo` or `redis`.

## 6. Set up MongoDB Atlas for production (managed database)

Atlas is one managed MongoDB option; another provider is fine if it gives you a MongoDB connection URI.

1. Create an account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Create a project, then create a database deployment/cluster. Choose a region near your application server.
3. In **Database Access**, create a database user with a unique password. This is not necessarily your Atlas website password.
4. In **Network Access**, allow connections from the application server’s outbound IP address. For a temporary learning setup, Atlas may allow `0.0.0.0/0`, but that permits attempts from any IP and should not be the final production rule. Never use that as a substitute for a strong database password.
5. Select **Connect** on the deployment and choose the application connection string option.
6. Replace the username, password, and database name placeholders. URL-encode special characters in the password if the provider requires it.
7. Save the URI as a server-side production secret named exactly as the application expects (often `MONGODB_URI`).
8. Ensure the server binds to its platform-provided port and can reach Atlas. Do not put the MongoDB URI in a `VITE_` variable.

Keep a separate database user for the application. Grant only the access it needs and rotate its password if it is exposed.

## 7. Set up Redis for production

Choose one approach:

- **Managed Redis**: create a Redis database with a provider, select a region near the app, and copy its private connection URL/TLS URL and credentials. This is easiest to operate reliably.
- **Self-hosted Redis**: run Redis on a private network alongside the app, protect it with authentication and network rules, and configure persistence/monitoring. Avoid exposing port `6379` publicly.

Set the server-side environment variable expected by the code (commonly `REDIS_URL`). Use the provider’s TLS URL when supplied. Do not use `localhost` for a managed database. Do not put the Redis URL in frontend variables. Verify that the app actually uses Redis for sessions, caching, queues, or rate limiting; adding a Redis container alone does not make the application use it.

## 8. Prepare a production host

Pick a host that can run your Docker image or Docker Compose stack. Examples include a VPS or a managed container platform. The exact steps depend on your chosen provider, but the required setup is the same:

1. Create the application service and choose a region close to your users and database.
2. Connect the GitHub repository or configure the host to pull the image published by CI.
3. Configure the production start command/port if the host does not infer them from Docker.
4. Add server environment variables in the host’s secret/environment settings. At minimum, expect a database URI, Redis URI if enabled, JWT signing secret(s), frontend origin/CORS settings, and `NODE_ENV=production`; use the exact names required by the code.
5. Add the frontend’s public API URL at build time if Vite embeds it during build. Vite `VITE_*` values are public in the browser bundle, so use them only for non-secret values such as the API base URL.
6. Restrict MongoDB and Redis network access to the application host where possible.
7. Add a custom domain and enable the host’s HTTPS certificate. Set the frontend origin and backend CORS allowlist to the final HTTPS domain(s).
8. Configure health checks and restart behavior. Use the health path provided by the application, if any.
9. Keep backups enabled for production MongoDB and test that you can restore one.

Mantra fingerprint capture is tied to the local Windows device and official RD Service workflow described in your notes. A cloud server cannot directly access a receptionist’s USB fingerprint reader. Keep capture on a trusted local Windows machine/client workflow and send only the supported verification/enrollment result to the backend, following Mantra’s SDK and data-handling rules.

## 9. Configure GitHub Actions secrets for CI/CD

The workflow file defines what secrets and variables are required. Open `.github/workflows/` and search for `${{ secrets.NAME }}` and `${{ vars.NAME }}`. Add every referenced value in GitHub under **Repository → Settings → Secrets and variables → Actions**.

Common secret categories (names below are examples; match the workflow exactly):

- Registry login: `REGISTRY_USERNAME`, `REGISTRY_TOKEN` or cloud registry credentials.
- Deployment: SSH host/user/private key, or the deployment platform’s API token.
- Runtime: MongoDB URI, Redis URI, JWT secrets, payment gateway secrets, email/SMS provider keys.
- Public build configuration: API base URL may be an Actions variable or build argument; it is not a secret.

Beginner sequence:

1. Create a GitHub repository and push the project to it. Ensure `.env` files and private keys are ignored and not already committed.
2. Open **Actions** in GitHub and confirm the workflow appears. If Actions are disabled, enable them for the repository.
3. Read each workflow’s `on:` section to learn which branch/pull request triggers it. Do not assume every push deploys production.
4. Add the exact secrets/variables referenced by the workflow.
5. Push a small change to a non-production branch or open a pull request. Watch the workflow run and open a failed step for its error log.
6. Make CI build/lint checks pass before enabling production deployment.
7. Configure a protected production environment if supported: require review for deployment, and scope production secrets to that environment.
8. Trigger a deployment only after the workflow, host, database, Redis, domain, and secrets are configured.

Never print secrets in workflow logs. Avoid passing secret values as command-line arguments where possible. Use GitHub Actions secrets, short-lived cloud credentials where available, and least-privilege tokens.

## 10. First deployment checklist

Before sending real users to the site, verify each item:

- [ ] Docker image builds successfully and starts with the production command.
- [ ] The application connects to the production MongoDB URI from the deployed environment.
- [ ] Redis is reachable privately and the app’s Redis features work.
- [ ] No database, Redis, JWT, payment, or provider secret is present in client files, built frontend assets, or Git history.
- [ ] CORS allows only the intended frontend origins.
- [ ] HTTPS works on the real domain, and the frontend API URL uses HTTPS.
- [ ] Authentication secrets are strong and unique to production.
- [ ] Admin account creation/bootstrap is secure; no demo credentials remain enabled.
- [ ] Database backups and a restore path are configured.
- [ ] Logs and health checks work without exposing passwords, tokens, or biometric data.
- [ ] The biometric integration has been validated on the actual Windows machine and device using Mantra’s official SDK/RD Service instructions.
- [ ] CI runs successfully on a pull request, and the production deployment is gated appropriately.

## Troubleshooting

**Docker says it cannot connect to the daemon:** Start Docker Desktop and wait until it reports that Docker is running.

**API cannot connect to MongoDB/Redis:** Check whether the API runs on Windows or inside Docker. Use `localhost` from Windows, but use the Compose service name from another container. Check container status and logs.

**Atlas connection times out:** Check the Atlas network access allowlist, database username/password, URI encoding, and whether the application host can make outbound connections.

**Browser reports CORS errors:** Set the backend CORS origin to the exact frontend origin, including scheme and hostname. Do not use a broad wildcard with credentialed requests.

**GitHub workflow says a secret is empty:** Compare the secret spelling and casing in the workflow with the GitHub secret name. Secrets are scoped to a repository or environment.

**Frontend still calls localhost after deployment:** The Vite API URL is likely embedded at build time. Set the correct public API URL in the build environment and rebuild/redeploy.

**Redis works locally but not in production:** Check the managed provider’s TLS requirements, credentials, firewall/network rules, and the exact variable name expected by the code.

## Provider-neutral reference links

- Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/
- Docker Compose: https://docs.docker.com/compose/
- MongoDB Atlas: https://www.mongodb.com/docs/atlas/getting-started/
- GitHub Actions secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- GitHub Actions environments: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment
- Vite environment variables: https://vite.dev/guide/env-and-mode

