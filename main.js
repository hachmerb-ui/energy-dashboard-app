const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn, execSync } = require("child_process");

let mainWindow;
const processes = {}; // { projectName: [childProcess, ...] }

function getProjectPath(project) {
  const home = app.getPath("home");
  const candidates = [
    // Manueller Override, z. B. ENERGY_PROJECTS_DIR=/Users/berndhachmer/Projects
    process.env.ENERGY_PROJECTS_DIR && path.join(process.env.ENERGY_PROJECTS_DIR, project),
    // Dev-Modus: Geschwisterordner der App
    !app.isPackaged && path.join(__dirname, "..", project),
    path.join(home, "Projects", "energy", project),
    path.join(home, "Projects", project),
    path.join(home, "Documents", "Projects", project),
  ].filter(Boolean);

  const found = candidates.find((dir) => fs.existsSync(dir));
  if (found) return found;

  console.error(`[${project}] Projektordner nicht gefunden. Gesucht in:\n  ${candidates.join("\n  ")}`);
  return candidates[candidates.length - 1];
}

function findExecutable(name) {
  try {
    return execSync(`which ${name}`, { encoding: "utf8", env: { PATH: getExtendedPath() } }).trim() || null;
  } catch {
    return null;
  }
}

function getExtendedPath() {
  const home = app.getPath("home");
  const additions = [
    // Homebrew auf Apple Silicon
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    // Homebrew auf Intel-Macs (z. B. iMac 2019)
    "/usr/local/bin",
    "/usr/local/sbin",
    `${home}/.local/bin`,
    `${home}/.cargo/bin`,
    `${home}/Library/pnpm`,
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
  const currentPath = process.env.PATH || "";
  const merged = [...additions, ...currentPath.split(":")].filter(Boolean);
  return [...new Set(merged)].join(":");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Beendet die komplette Prozessgruppe (Shell + uvicorn/vite/tsx-Kinder).
function killProcessTree(proc, signal) {
  if (!proc || proc.pid == null) return;
  try {
    process.kill(-proc.pid, signal);
  } catch {
    try { proc.kill(signal); } catch { /* bereits beendet */ }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("renderer/index.html");
}

// ─── IPC Handlers ────────────────────────────────────────────

ipcMain.handle("check-prerequisites", async () => {
  const results = {
    uv: !!findExecutable("uv"),
    node: !!findExecutable("node"),
    pnpm: !!findExecutable("pnpm"),
  };
  results.allOk = results.uv && results.node && results.pnpm;
  return results;
});

ipcMain.handle("start-project", async (event, project) => {
  if (processes[project] && processes[project].length > 0) {
    const alive = processes[project].some((p) => !p.killed && p.exitCode === null);
    if (alive) return { success: false, output: "Projekt läuft bereits" };
  }

  const projectPath = getProjectPath(project);
  if (!fs.existsSync(projectPath)) {
    return { success: false, output: `Projektordner nicht gefunden: ${projectPath}` };
  }
  const env = { ...process.env, PATH: getExtendedPath() };
  const procs = [];

  try {
    if (project === "alphaess") {
      const backend = spawn("uv", ["run", "uvicorn", "app.interfaces.http.main:app", "--host", "127.0.0.1", "--port", "8000"], {
        cwd: path.join(projectPath, "backend"),
        env,
        shell: true,
        detached: true,
      });
      procs.push(backend);
      await sleep(3000);

      const bffEnv = { ...env, BACKEND_BASE_URL: "http://127.0.0.1:8000" };
      const bff = spawn("npx", ["tsx", "src/server.ts"], {
        cwd: path.join(projectPath, "bff"),
        env: bffEnv,
        shell: true,
        detached: true,
      });
      procs.push(bff);
      await sleep(2000);

      const frontend = spawn("pnpm", ["dev"], {
        cwd: path.join(projectPath, "frontend"),
        env,
        shell: true,
        detached: true,
      });
      procs.push(frontend);

    } else if (project === "zappi-dashboard") {
      const backend = spawn("uv", ["run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8010"], {
        cwd: path.join(projectPath, "backend"),
        env,
        shell: true,
        detached: true,
      });
      procs.push(backend);
      await sleep(3000);

      const frontend = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "5174"], {
        cwd: path.join(projectPath, "frontend"),
        env,
        shell: true,
        detached: true,
      });
      procs.push(frontend);
    }

    procs.forEach((proc) => {
      proc.on("error", (err) => console.error(`[${project}] Process error: ${err.message}`));
      proc.stdout?.on("data", (d) => console.log(`[${project}] ${d.toString().trimEnd()}`));
      proc.stderr?.on("data", (d) => console.error(`[${project}] ${d.toString().trimEnd()}`));
    });

    processes[project] = procs;
    return { success: true, output: `${procs.length} Services gestartet` };
  } catch (err) {
    return { success: false, output: err.message };
  }
});

ipcMain.handle("stop-project", async (event, project) => {
  const procs = processes[project];
  if (!procs || procs.length === 0) return { success: true };

  procs.forEach((proc) => killProcessTree(proc, "SIGTERM"));
  await sleep(2000);
  procs.forEach((proc) => {
    if (proc.exitCode === null && !proc.killed) killProcessTree(proc, "SIGKILL");
  });

  processes[project] = [];
  return { success: true };
});

ipcMain.handle("open-dashboard", async (event, url) => {
  shell.openExternal(url);
});

// ─── Einstellungen (.env-Dateien) ────────────────────────────

const ENV_TARGETS = {
  alphaess: ["backend", ".env"],
  "zappi-dashboard": ["backend", ".env"],
};

function readEnvFile(project) {
  const target = ENV_TARGETS[project];
  if (!target) return {};
  const file = path.join(getProjectPath(project), ...target);
  if (!fs.existsSync(file)) return {};

  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return values;
}

function writeEnvFile(project, values) {
  const target = ENV_TARGETS[project];
  if (!target) throw new Error(`Unbekanntes Projekt: ${project}`);

  const dir = path.join(getProjectPath(project), target[0]);
  if (!fs.existsSync(dir)) throw new Error(`Ordner nicht gefunden: ${dir}`);

  const file = path.join(dir, target[1]);
  const body = Object.entries(values)
    .filter(([key]) => /^[A-Z0-9_]+$/.test(key))
    .map(([key, value]) => `${key}=${String(value ?? "").replace(/[\r\n]/g, "")}`)
    .join("\n");

  // 0600: nur der angemeldete Benutzer darf die Zugangsdaten lesen
  fs.writeFileSync(file, `${body}\n`, { encoding: "utf8", mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch { /* Dateisystem ohne POSIX-Rechte */ }
  return file;
}

ipcMain.handle("get-settings", async (event, project) => {
  try {
    return { success: true, values: readEnvFile(project) };
  } catch (err) {
    return { success: false, output: err.message, values: {} };
  }
});

ipcMain.handle("save-settings", async (event, project, values) => {
  try {
    const file = writeEnvFile(project, values);
    return { success: true, output: `Gespeichert: ${file}` };
  } catch (err) {
    return { success: false, output: err.message };
  }
});

// ─── Zugangsdaten testen ─────────────────────────────────────

// AlphaESS signiert jede Anfrage mit sha512(appId + appSecret + Zeitstempel).
ipcMain.handle("test-alpha-credentials", async (event, appId, appSecret) => {
  const id = String(appId || "").trim();
  const secret = String(appSecret || "").trim();
  if (!id || !secret) {
    return { success: false, output: "Bitte App-ID und App-Secret eintragen." };
  }

  const timeStamp = String(Math.floor(Date.now() / 1000));
  const sign = crypto.createHash("sha512").update(`${id}${secret}${timeStamp}`).digest("hex");

  let body;
  try {
    const response = await fetch("https://openapi.alphaess.com/api/getEssList", {
      headers: { appId: id, timeStamp, sign },
      signal: AbortSignal.timeout(15000),
    });
    body = await response.json();
  } catch (err) {
    return { success: false, output: `Keine Verbindung zu AlphaESS: ${err.message}` };
  }

  const code = body?.code;
  if (code === 6007 || code === 6053) {
    return {
      success: false,
      output: "AlphaESS lehnt die Zugangsdaten ab. App-ID und Secret nochmals aus dem Portal kopieren – ein zurückgesetztes Secret macht das alte ungültig.",
    };
  }
  if (code !== 200) {
    return { success: false, output: `AlphaESS meldet Fehler ${code}: ${body?.msg ?? "unbekannt"}` };
  }

  const systems = Array.isArray(body.data) ? body.data : [];
  if (systems.length === 0) {
    return {
      success: false,
      output: "Zugangsdaten sind gültig, aber es ist keine Anlage verknüpft. Im AlphaESS-Portal muss die Anlage mit Seriennummer und CheckCode hinzugefügt werden.",
    };
  }

  const names = systems.map((s) => s.sysSn || s.sn).filter(Boolean).join(", ");
  return { success: true, output: `Verbindung OK – ${systems.length} Anlage(n): ${names}` };
});

ipcMain.handle("get-status", async () => {
  const results = {};
  for (const project of ["alphaess", "zappi-dashboard"]) {
    const procs = processes[project] || [];
    const alive = procs.some((p) => !p.killed && p.exitCode === null);
    results[project] = alive ? "running" : "stopped";
  }
  return results;
});

// pnpm 11 beendet sich mit Fehlercode, wenn Pakete Build-Skripte mitbringen
// (ERR_PNPM_IGNORED_BUILDS). Fuer diese Projekte ist das unkritisch.
const PNPM_INSTALL_ARGS = ["install", "--config.strictDepBuilds=false"];

ipcMain.handle("install-deps", async (event, project) => {
  const projectPath = getProjectPath(project);
  const env = { ...process.env, PATH: getExtendedPath() };

  return new Promise((resolve) => {
    const steps = [];
    if (project === "alphaess") {
      steps.push({ cmd: "uv", args: ["sync"], cwd: path.join(projectPath, "backend") });
      steps.push({ cmd: "pnpm", args: PNPM_INSTALL_ARGS, cwd: path.join(projectPath, "bff") });
      steps.push({ cmd: "pnpm", args: PNPM_INSTALL_ARGS, cwd: path.join(projectPath, "frontend") });
    } else if (project === "zappi-dashboard") {
      steps.push({ cmd: "uv", args: ["sync"], cwd: path.join(projectPath, "backend") });
      steps.push({ cmd: "npm", args: ["install"], cwd: path.join(projectPath, "frontend") });
    }

    let output = "";
    let stepIdx = 0;
    function runNext() {
      if (stepIdx >= steps.length) { resolve({ success: true, output }); return; }
      const step = steps[stepIdx++];
      const proc = spawn(step.cmd, step.args, { cwd: step.cwd, env, shell: true });
      proc.stdout.on("data", (d) => { output += d.toString(); });
      proc.stderr.on("data", (d) => { output += d.toString(); });
      proc.on("close", (code) => { code !== 0 ? resolve({ success: false, output }) : runNext(); });
      proc.on("error", (err) => { resolve({ success: false, output: err.message }); });
    }
    runNext();
  });
});

// ─── App Lifecycle ───────────────────────────────────────────

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  for (const project of Object.keys(processes)) {
    for (const proc of (processes[project] || [])) {
      killProcessTree(proc, "SIGTERM");
    }
  }
  app.quit();
});
