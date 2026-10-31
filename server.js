// Root proxy entry point for backend server
const path = require("path");

const backendDir = path.resolve(__dirname, "psychometric-patent", "psychometric-system-backup", "backend");

// Switch process working directory to backend so .env, uploads, and relative paths resolve seamlessly
process.chdir(backendDir);

// Launch backend server
require(path.join(backendDir, "server.js"));
