$ErrorActionPreference = "Stop"
docker compose -f "$PSScriptRoot\..\docker-compose.yml" up -d --build
Write-Host "App running at http://localhost:8000"
