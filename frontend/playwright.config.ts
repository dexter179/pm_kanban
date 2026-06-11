import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Tests share one persistent board, so run them serially.
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "retain-on-failure",
  },
  // Build the static export and serve it through the FastAPI backend,
  // matching the production (Docker) serving path.
  webServer: {
    command:
      "npm run build && node -e \"fs.rmSync('../backend/data/e2e.db', { force: true })\" && uv --directory ../backend run uvicorn app.main:app --host 127.0.0.1 --port 8000",
    url: "http://127.0.0.1:8000/api/health",
    reuseExistingServer: true,
    timeout: 180_000,
    // Fresh throwaway database for each e2e server start.
    env: { STATIC_DIR: "../frontend/out", DB_PATH: "data/e2e.db" },
  },
  projects: [
    {
      name: "chromium",
      // channel "chromium" runs headless with the full chromium binary,
      // avoiding the separate headless-shell download.
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
});
