const { execFileSync, execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("====================================================");
console.log("🚀 Starting Lost and Found Portal (Local Server)...");
console.log("====================================================");
console.log("");

// 1. Read PORT from backend/.env
let port = 5004;
try {
    const envPath = path.join(__dirname, "backend", ".env");
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
        if (portMatch) {
            port = parseInt(portMatch[1], 10);
        }
    }
} catch (err) {
    console.error("Warning: Failed to read .env file:", err.message);
}

// 2. Free port if occupied
if (process.platform === "win32") {
    try {
        const checkCmd = "netstat -ano";
        const stdout = execSync(checkCmd).toString();
        const lines = stdout.split(/\r?\n/);
        let pid = null;

        for (const line of lines) {
            if (line.includes(`:${port}`) && line.includes("LISTENING")) {
                const parts = line.trim().split(/\s+/);
                pid = parts[parts.length - 1];
                break;
            }
        }

        if (pid && pid !== "0" && !isNaN(pid) && parseInt(pid, 10) !== process.pid) {
            console.log(`🧹 Port ${port} is in use. Freeing it up (Killing process ${pid})...`);
            try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
            } catch (kErr) { }
        }
    } catch (e) {
        // Port is free
    }
}

// 3. Install backend dependencies if missing
const backendDir = path.join(__dirname, "backend");
if (!fs.existsSync(path.join(backendDir, "node_modules"))) {
    console.log("📦 Installing backend dependencies, please wait...");
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install"], {
        cwd: backendDir,
        stdio: "inherit"
    });
}

// 4. Start backend server
console.log("🌐 Starting backend server...");
const serverProcess = spawn(process.platform === "win32" ? "node.exe" : "node", ["server.js"], {
    cwd: backendDir,
    stdio: ["inherit", "pipe", "pipe"],
    shell: false
});

serverProcess.stdout.on("data", (data) => {
    process.stdout.write(data);
});
serverProcess.stderr.on("data", (data) => {
    process.stderr.write(data);
});

const localUrl = `http://localhost:${port}`;
console.log("\n====================================================");
console.log("🎉 LOST AND FOUND PORTAL IS READY!");
console.log(`🏠 Local URL: ${localUrl}`);
console.log("====================================================\n");

// 5. Open local browser
setTimeout(() => {
    try {
        if (process.platform === "win32") {
            execSync(`start ${localUrl}`);
        } else if (process.platform === "darwin") {
            execSync(`open ${localUrl}`);
        } else {
            execSync(`xdg-open ${localUrl}`);
        }
    } catch (err) { }
}, 1000);

// 6. Cleanup on exit
function cleanup() {
    console.log("\n🛑 Stopping server...");
    if (serverProcess) {
        try { serverProcess.kill(); } catch (e) { }
    }
    process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", () => {
    if (serverProcess) { try { serverProcess.kill(); } catch (e) { } }
});


//Email / Username: lostfound@admin.com
//Password: lostfound@123456

