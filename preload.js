const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  checkPrerequisites: () => ipcRenderer.invoke("check-prerequisites"),
  startProject: (project) => ipcRenderer.invoke("start-project", project),
  stopProject: (project) => ipcRenderer.invoke("stop-project", project),
  openDashboard: (url) => ipcRenderer.invoke("open-dashboard", url),
  getStatus: () => ipcRenderer.invoke("get-status"),
  installDeps: (project) => ipcRenderer.invoke("install-deps", project),
  getSettings: (project) => ipcRenderer.invoke("get-settings", project),
  saveSettings: (project, values) => ipcRenderer.invoke("save-settings", project, values),
});
