# Synthesia Avatar POC

A real-time conversational avatar that answers questions using a Confluence page as its knowledge base. The avatar runs as a [LiveKit Agent](https://docs.livekit.io/agents/) (STT → LLM → TTS) with a [Synthesia](https://docs.synthesia.io) video avatar, and can be reached from either a standalone web app or a Jira Service Management Forge app.

## Architecture

```
web/      React + Vite frontend (dev/demo client)
forge/    Jira Service Management portal action (production client)
synthesia/
  agent.py         LiveKit Agent worker: fetches the Confluence page, runs STT/LLM/TTS, starts the Synthesia avatar
  token_server.py  Local token endpoint used by the web/ frontend
```

Both frontends get a LiveKit access token (from `token_server.py` or the Forge resolver), join a LiveKit room, and LiveKit dispatches `agent.py` into that room to drive the avatar.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ and npm
- [Python](https://www.python.org/) 3.11+
- [Forge CLI](https://developer.atlassian.com/platform/forge/set-up-forge/) (`npm install -g @forge/cli`) — only needed for the `forge/` app
- A [LiveKit Cloud](https://cloud.livekit.io) project
- A [Synthesia](https://www.synthesia.io) account with API access and an avatar ID
- A Confluence page and API token ([manage API tokens](https://id.atlassian.com/manage-profile/security/api-tokens))

## 1. Configure environment variables

Copy the template and fill in real values:

```powershell
Copy-Item .env.example .env
```

| Variable                                    | Description                                  |
| ------------------------------------------- | -------------------------------------------- |
| `LIVEKIT_URL` / `VITE_LIVEKIT_URL`          | Your LiveKit Cloud project URL (`wss://...`) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`    | From your LiveKit Cloud project settings     |
| `SYNTHESIA_API_KEY`                         | Synthesia API key                            |
| `AVATAR_ID`                                 | Synthesia avatar ID to use                   |
| `CONFLUENCE_BASE_URL`                       | e.g. `https://your-domain.atlassian.net`     |
| `CONFLUENCE_PAGE_ID`                        | Page ID to use as the knowledge base         |
| `CONFLUENCE_EMAIL` / `CONFLUENCE_API_TOKEN` | Credentials for the Confluence REST API      |

`.env` is gitignored — never commit it.

## 2. Run the agent (synthesia/)

```powershell
cd synthesia
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python agent.py dev
```

`python agent.py dev` connects the worker to LiveKit Cloud and waits to be dispatched into a room. Keep this running in its own terminal.

## 3a. Run the web frontend (for local development)

In a second terminal, start the local token server (reads `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` from `.env`):

```powershell
cd synthesia
.\.venv\Scripts\Activate.ps1
python token_server.py
```

In a third terminal, start the Vite dev server (proxies `/token` to the server above, see [web/vite.config.js](web/vite.config.js)):

```powershell
cd web
npm install
npm run dev
```

Open the printed `localhost` URL, click **Start**, allow microphone access, and the avatar should join.

## 3b. Run the Forge app (for JSM portal deployment)

```powershell
cd forge
npm install
cd static/forge-synthesia
npm install
cd ../..
forge login
```

Forge apps don't read `.env` — set the same LiveKit values as Forge environment variables (one-time, per environment):

```powershell
forge variables set --encrypt LIVEKIT_API_KEY "<your-key>"
forge variables set --encrypt LIVEKIT_API_SECRET "<your-secret>"
forge variables set LIVEKIT_URL "<your-livekit-url>"
```

[forge/manifest.yml](forge/manifest.yml) ships with placeholder domains under `permissions.external.fetch.client` — replace `your-project.livekit.cloud` with your actual LiveKit Cloud project domain (both the `https://` and `wss://` entries) before deploying, then run `forge lint` to validate.

Build and deploy:

```powershell
.\build_deploy.ps1
```

(or manually: `npm run build` inside `static/forge-synthesia`, then `forge deploy -e development` from `forge/`)

Then install it on your site:

```powershell
forge install --non-interactive --site <your-site-url> --product jira-service-management --environment development
```

The action appears as **"Talk to the avatar"** in the JSM customer portal request view.

## Notes

- Each session creates a fresh LiveKit room (`avatar-poc-<random>`), which is what triggers LiveKit to dispatch `agent.py` (`agent_name="avatar-poc"` must match in both the token issuer and the worker).
- Rotate any credentials that were ever committed, pasted into chat, or otherwise shared outside this `.env` file — treat them as compromised.
