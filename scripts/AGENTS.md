# Scripts

Start and stop the app container via docker compose (repo-root `docker-compose.yml`, app on http://localhost:8000).

- `start.ps1` / `stop.ps1` - Windows
- `start.sh` / `stop.sh` - Mac and Linux

Start runs `docker compose up -d --build`; stop runs `docker compose down`. The compose file reads the env file from `../.env` (one level above the repo root).
