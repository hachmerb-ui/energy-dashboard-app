const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  checkDocker: () => ipcRenderer.invoke("check-docker"),
  startProject: (project) => ipcRenderer.invoke("start-project", project),
  stopProject: (project) => ipcRenderer.invoke("stop-project", project),
  openDashboard: (url) => ipcRenderer.invoke("open-dashboard", url),
  getStatus: () => ipcRenderer.invoke("get-status"),
});
