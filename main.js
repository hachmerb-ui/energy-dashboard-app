const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");

let mainWindow;
const processes = {}; // { projectName: [childProcess, ...] }

function getProjectPath(project) {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, "..", project);
  }
  return path.join(app.getPath("home"), "Projects", "energy", project);
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
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    `${home}/.local/bin`,
    `${home}/.cargo/bin`,
    `${home}/Library/pnpm`,
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
  const currentPath = process.env.PATH || "";
  return [...additions, ...currentPath.split(":")].join(":");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const env = { ...process.env, PATH: getExtendedPath() };
  const procs = [];

  try {
    if (project === "alphaess") {
      const backend = spawn("uv", ["run", "uvicorn", "app.interfaces.http.main:app", "--host", "127.0.0.1", "--port", "8000"], {
        cwd: path.join(projectPath, "backend"),
        env,
        shell: true,
      });
      procs.push(backend);
      await sleep(3000);

      const bffEnv = { ...env, BACKEND_BASE_URL: "http://127.0.0.1:8000" };
      const bff = spawn("npx", ["tsx", "src/server.ts"], {
        cwd: path.join(projectPath, "bff"),
        env: bffEnv,
        shell: true,
      });
      procs.push(bff);
      await sleep(2000);

      const frontend = spawn("pnpm", ["dev"], {
        cwd: path.join(projectPath, "frontend"),
        env,
        shell: true,
      });
      procs.push(frontend);

    } else if (project === "zappi-dashboard") {
      const backend = spawn("uv", ["run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8010"], {
        cwd: path.join(projectPath, "backend"),
        env,
        shell: true,
      });
      procs.push(backend);
      await sleep(3000);

      const frontend = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "5174"], {
        cwd: path.join(projectPath, "frontend"),
        env,
        shell: true,
      });
      procs.push(frontend);
    }

    procs.forEach((proc) => {
      proc.on("error", (err) => console.error(`Process error: ${err.message}`));
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

  for (const proc of procs) {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      try { proc.kill("SIGTERM"); } catch { /* already dead */ }
    }
  }
  processes[project] = [];
  return { success: true };
});

ipcMain.handle("open-dashboard", async (event, url) => {
  shell.openExternal(url);
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

ipcMain.handle("install-deps", async (event, project) => {
  const projectPath = getProjectPath(project);
  const env = { ...process.env, PATH: getExtendedPath() };

  return new Promise((resolve) => {
    const steps = [];
    if (project === "alphaess") {
      steps.push({ cmd: "uv", args: ["sync"], cwd: path.join(projectPath, "backend") });
      steps.push({ cmd: "pnpm", args: ["install"], cwd: path.join(projectPath, "bff") });
      steps.push({ cmd: "pnpm", args: ["install"], cwd: path.join(projectPath, "frontend") });
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
      try { process.kill(-proc.pid, "SIGTERM"); } catch {
        try { proc.kill("SIGTERM"); } catch { /* ignore */ }
      }
    }
  }
  app.quit();
});
