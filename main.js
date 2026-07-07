const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");

let mainWindow;
let dockerProcesses = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("renderer/index.html");
}

function getDockerComposePath(project) {
  // In development, use sibling folders; in production, use extraResources
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, "..", project);
  }
  return path.join(process.resourcesPath, "docker", project);
}

function isDockerRunning() {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle("check-docker", async () => {
  return isDockerRunning();
});

ipcMain.handle("start-project", async (event, project) => {
  const composePath = getDockerComposePath(project);

  return new Promise((resolve, reject) => {
    const proc = spawn("docker", ["compose", "up", "--build", "-d"], {
      cwd: composePath,
      shell: true,
    });

    let output = "";
    proc.stdout.on("data", (data) => { output += data.toString(); });
    proc.stderr.on("data", (data) => { output += data.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        dockerProcesses[project] = true;
        resolve({ success: true, output });
      } else {
        resolve({ success: false, output });
      }
    });

    proc.on("error", (err) => {
      resolve({ success: false, output: err.message });
    });
  });
});

ipcMain.handle("stop-project", async (event, project) => {
  const composePath = getDockerComposePath(project);

  return new Promise((resolve) => {
    const proc = spawn("docker", ["compose", "down"], {
      cwd: composePath,
      shell: true,
    });

    proc.on("close", () => {
      delete dockerProcesses[project];
      resolve({ success: true });
    });

    proc.on("error", (err) => {
      resolve({ success: false, output: err.message });
    });
  });
});

ipcMain.handle("open-dashboard", async (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle("get-status", async () => {
  const results = {};
  for (const project of ["alphaess", "zappi-dashboard"]) {
    try {
      const composePath = getDockerComposePath(project);
      const output = execSync(`docker compose ps --format json`, {
        cwd: composePath,
        encoding: "utf8",
        timeout: 5000,
      });
      results[project] = output.trim().length > 0 ? "running" : "stopped";
    } catch {
      results[project] = "stopped";
    }
  }
  return results;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  // Stop all running containers on app exit
  for (const project of Object.keys(dockerProcesses)) {
    try {
      const composePath = getDockerComposePath(project);
      execSync("docker compose down", { cwd: composePath, shell: true });
    } catch {
      // ignore errors during shutdown
    }
  }
});
