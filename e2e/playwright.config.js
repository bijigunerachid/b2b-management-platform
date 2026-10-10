// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const { DB_NAME } = require("./accounts");

// Separate ports from the dev servers, so the tests never talk to your dev data.
const API_PORT = Number(process.env.E2E_API_PORT || 5055);
const APP_PORT = Number(process.env.E2E_APP_PORT || 5175);
const APP_URL = `http://localhost:${APP_PORT}`;

module.exports = defineConfig({
    testDir: "./tests",
    // One shared database: run tests one after another so they don't race.
    workers: 1,
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    timeout: 45_000,
    expect: { timeout: 10_000 },
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
    globalSetup: require.resolve("./global-setup.js"),
    use: {
        baseURL: APP_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        locale: "en-GB",
        timezoneId: "Africa/Casablanca"
    },
    projects: [
        { name: "setup", testMatch: /auth\.setup\.js/ },
        { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } }, dependencies: ["setup"] }
    ],
    webServer: [
        {
            command: "node src/server.js",
            cwd: "../backend",
            // "/" answers without a database; global setup builds it.
            url: `http://localhost:${API_PORT}/`,
            reuseExistingServer: !process.env.CI,
            env: {
                PORT: String(API_PORT),
                DB_NAME,
                CORS_ORIGIN: APP_URL,
                JWT_SECRET: process.env.JWT_SECRET || "e2e-only-secret-that-is-long-enough-for-validation"
            }
        },
        {
            command: `npx vite --port ${APP_PORT} --strictPort`,
            cwd: "../frontend",
            url: APP_URL,
            reuseExistingServer: !process.env.CI,
            env: { VITE_API_URL: `http://localhost:${API_PORT}` }
        }
    ]
});
