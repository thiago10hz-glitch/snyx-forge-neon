const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snyxAPI', {
  // Auth
  login: (email, password) => ipcRenderer.invoke('login', email, password),
  activateKey: (key) => ipcRenderer.invoke('activate-key', key),
  checkLicense: () => ipcRenderer.invoke('check-license'),
  
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (data) => ipcRenderer.invoke('save-config', data),
  
  // Optimizations
  runOptimization: (moduleId) => ipcRenderer.invoke('run-optimization', moduleId),
  runAllOptimizations: () => ipcRenderer.invoke('run-all-optimizations'),
  revertAll: () => ipcRenderer.invoke('revert-all'),
  
  // VPN
  setupVPN: (config) => ipcRenderer.invoke('setup-vpn', config),
  removeVPN: () => ipcRenderer.invoke('remove-vpn'),
  
  // Network
  cleanupNetwork: () => ipcRenderer.invoke('cleanup-network'),
  
  // System
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  selfDestruct: () => ipcRenderer.invoke('self-destruct'),
  
  // Window
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Events
  onLicenseRevoked: (callback) => {
    ipcRenderer.on('license-revoked', (_, reason) => callback(reason));
  },
  
  // Platform check
  isDesktop: true,
});
