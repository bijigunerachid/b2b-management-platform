const { execFileSync } = require("node:child_process");
const path = require("node:path");

// A fresh database for every run, unless E2E_SKIP_DB=1 (handy while writing a test).
module.exports = async () => {
    if (process.env.E2E_SKIP_DB === "1") return;
    execFileSync(process.execPath, [path.join(__dirname, "scripts/prepare-db.js")], { stdio: "inherit" });
};
