const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, exec } = require('child_process');
const https = require('https');
const http = require('http');

// SnyX Optimizer Desktop - Main Process
const SUPABASE_URL = 'https://umhqbgsvfjatcaiwtqnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaHFiZ3N2ZmphdGNhaXd0cW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjYzOTIsImV4cCI6MjA5MTYwMjM5Mn0.CxugRDD3Q9m5trKE34Ppf4utf8MccTm9KBDIWLE87ts';
const SNYX_DIR = path.join(process.env.USERPROFILE || process.env.HOME || '', 'SnyX-Optimizer');
const CONFIG_FILE = path.join(SNYX_DIR, 'config.json');
const WG_CONF_FILE = path.join(SNYX_DIR, 'snyx-vpn.conf');

let mainWindow = null;
let licenseCheckInterval = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#07070f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  if (!fs.existsSync(SNYX_DIR)) fs.mkdirSync(SNYX_DIR, { recursive: true });
  createWindow();
  startLicenseCheck();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ========== SUPABASE API HELPER ==========
function supabaseRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SUPABASE_URL);
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (options.authToken) headers['Authorization'] = `Bearer ${options.authToken}`;
    
    const reqOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers,
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ========== CONFIG ==========
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}
  return {};
}
function saveConfig(data) {
  if (!fs.existsSync(SNYX_DIR)) fs.mkdirSync(SNYX_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// ========== LICENSE CHECK ==========
async function checkLicense() {
  const config = loadConfig();
  if (!config.accessToken || !config.activationKey) return { valid: false, reason: 'no_key' };
  
  try {
    const res = await supabaseRequest(
      `/rest/v1/accelerator_keys?activation_key=eq.${encodeURIComponent(config.activationKey)}&select=*`,
      { authToken: config.accessToken }
    );
    if (!Array.isArray(res) || res.length === 0) return { valid: false, reason: 'key_not_found' };
    const key = res[0];
    if (key.status !== 'active') return { valid: false, reason: 'key_revoked' };
    if (key.expires_at && new Date(key.expires_at) < new Date()) return { valid: false, reason: 'key_expired' };
    return { valid: true, key };
  } catch {
    return { valid: true }; // Offline grace
  }
}

function startLicenseCheck() {
  if (licenseCheckInterval) clearInterval(licenseCheckInterval);
  licenseCheckInterval = setInterval(async () => {
    const result = await checkLicense();
    if (!result.valid) {
      if (mainWindow) {
        mainWindow.webContents.send('license-revoked', result.reason);
      }
      await selfDestruct();
    }
  }, 60000); // Check every minute
}

// ========== SELF DESTRUCT ==========
async function selfDestruct() {
  try {
    // 1. Revert all optimizations
    runRevertScript();
    // 2. Remove VPN config
    removeVPN();
    // 3. Delete all SnyX files
    const batContent = `@echo off
timeout /t 3 /nobreak >nul
rmdir /s /q "${SNYX_DIR}" 2>nul
rmdir /s /q "${path.dirname(app.getPath('exe'))}" 2>nul
del "%~f0" 2>nul
`;
    const batPath = path.join(process.env.TEMP || '/tmp', 'snyx-cleanup.bat');
    fs.writeFileSync(batPath, batContent);
    exec(`cmd /c start /min "${batPath}"`, { windowsHide: true });
  } catch {}
  app.quit();
}

// ========== OPTIMIZATION SCRIPTS ==========
function runOptimization(moduleId) {
  const scripts = {
    power: `
powercfg /duplicatescheme e9a42b02-d5df-370a-aa00-03f14749eb61 e9a42b02-d5df-448d-aa00-03f14749eb61 2>nul
if errorlevel 1 powercfg /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c e9a42b02-d5df-448d-aa00-03f14749eb61 2>nul
powercfg /changename e9a42b02-d5df-448d-aa00-03f14749eb61 "SnyX Ultimate Gaming" "SnyX Optimizer"
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /setactive e9a42b02-d5df-448d-aa00-03f14749eb61`,
    visual: `
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f
reg add "HKCU\\Control Panel\\Desktop\\WindowMetrics" /v MinAnimate /t REG_SZ /d 0 /f
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 0 /f
reg add "HKCU\\Software\\Microsoft\\Windows\\DWM" /v EnableAeroPeek /t REG_DWORD /d 0 /f`,
    network: `
netsh int tcp set global autotuninglevel=disabled
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 0xFFFFFFFF /f
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 0 /f`,
    cpu: `
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v Priority /t REG_DWORD /d 6 /f
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d "High" /f`,
    services: `
for %%s in (DiagTrack dmwappushservice WSearch SysMain) do (sc config %%s start=disabled & sc stop %%s) 2>nul`,
    ram: `
ipconfig /flushdns
powershell -Command "[System.GC]::Collect()"`,
    gamebar: `
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /t REG_DWORD /d 0 /f`,
    gpu: `
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f`,
    fullscreen: `
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 1 /f`,
    mouse: `
reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 0 /f
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 0 /f
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 0 /f`,
  };
  
  const script = scripts[moduleId];
  if (!script) return { success: false, error: 'Módulo não encontrado' };
  
  try {
    const batPath = path.join(SNYX_DIR, `opt-${moduleId}.bat`);
    fs.writeFileSync(batPath, `@echo off\n${script}\n`);
    execSync(`cmd /c "${batPath}"`, { windowsHide: true, timeout: 30000 });
    
    const config = loadConfig();
    if (!config.activeOptimizations) config.activeOptimizations = {};
    config.activeOptimizations[moduleId] = true;
    saveConfig(config);
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function runRevertScript() {
  try {
    const revertBat = `@echo off
powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e
powercfg /delete e9a42b02-d5df-448d-aa00-03f14749eb61 2>nul
powercfg /change standby-timeout-ac 30
powercfg /change hibernate-timeout-ac 180
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 0 /f
reg add "HKCU\\Control Panel\\Desktop\\WindowMetrics" /v MinAnimate /t REG_SZ /d 1 /f
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 1 /f
reg add "HKCU\\Software\\Microsoft\\Windows\\DWM" /v EnableAeroPeek /t REG_DWORD /d 1 /f
netsh int tcp set global autotuninglevel=normal
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 10 /f
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 20 /f
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 2 /f
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v Priority /t REG_DWORD /d 2 /f
for %%s in (DiagTrack dmwappushservice WSearch SysMain) do (sc config %%s start=auto & sc start %%s) 2>nul
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 1 /f
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /f 2>nul
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 0 /f
reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 1 /f
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 6 /f
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 10 /f
ipconfig /flushdns
netsh winsock reset
netsh int ip reset
`;
    const batPath = path.join(SNYX_DIR, 'revert-all.bat');
    fs.writeFileSync(batPath, revertBat);
    execSync(`cmd /c "${batPath}"`, { windowsHide: true, timeout: 60000 });
    
    const config = loadConfig();
    config.activeOptimizations = {};
    saveConfig(config);
  } catch {}
}

// ========== VPN ==========
function removeVPN() {
  try {
    if (process.platform === 'win32') {
      execSync('wireguard /uninstalltunnelservice snyx-vpn 2>nul', { windowsHide: true });
    }
    if (fs.existsSync(WG_CONF_FILE)) fs.unlinkSync(WG_CONF_FILE);
  } catch {}
}

// ========== NETWORK CLEANUP ==========
function cleanupNetwork() {
  try {
    const bat = `@echo off
ipconfig /flushdns
netsh winsock reset
netsh int ip reset
ipconfig /release
ipconfig /renew
`;
    const batPath = path.join(SNYX_DIR, 'net-cleanup.bat');
    fs.writeFileSync(batPath, bat);
    execSync(`cmd /c "${batPath}"`, { windowsHide: true, timeout: 30000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ========== IPC HANDLERS ==========
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-config', (_, data) => { saveConfig(data); return true; });

ipcMain.handle('login', async (_, email, password) => {
  try {
    const res = await supabaseRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email, password },
    });
    if (res.access_token) {
      const config = loadConfig();
      config.accessToken = res.access_token;
      config.refreshToken = res.refresh_token;
      config.userId = res.user.id;
      config.email = email;
      saveConfig(config);
      return { success: true, user: res.user };
    }
    return { success: false, error: res.error_description || res.msg || 'Erro de login' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('activate-key', async (_, key) => {
  const config = loadConfig();
  if (!config.accessToken) return { success: false, error: 'Faça login primeiro' };
  
  try {
    const res = await supabaseRequest('/rest/v1/rpc/activate_accelerator_key', {
      method: 'POST',
      authToken: config.accessToken,
      body: { p_key: key },
    });
    if (res.success) {
      config.activationKey = key;
      saveConfig(config);
      return { success: true, message: res.message };
    }
    return { success: false, error: res.error || 'Falha na ativação' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('check-license', async () => checkLicense());

ipcMain.handle('run-optimization', async (_, moduleId) => runOptimization(moduleId));

ipcMain.handle('run-all-optimizations', async () => {
  const modules = ['power', 'visual', 'network', 'cpu', 'services', 'ram', 'gamebar', 'gpu', 'fullscreen', 'mouse'];
  const results = {};
  for (const mod of modules) {
    results[mod] = runOptimization(mod);
  }
  return results;
});

ipcMain.handle('revert-all', async () => {
  runRevertScript();
  return { success: true };
});

ipcMain.handle('setup-vpn', async (_, wgConfig) => {
  try {
    if (!fs.existsSync(SNYX_DIR)) fs.mkdirSync(SNYX_DIR, { recursive: true });
    fs.writeFileSync(WG_CONF_FILE, wgConfig);
    if (process.platform === 'win32') {
      execSync(`wireguard /installtunnelservice "${WG_CONF_FILE}"`, { windowsHide: true });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('remove-vpn', async () => {
  removeVPN();
  return { success: true };
});

ipcMain.handle('cleanup-network', async () => cleanupNetwork());

ipcMain.handle('self-destruct', async () => {
  await selfDestruct();
  return { success: true };
});

ipcMain.handle('get-system-info', async () => {
  try {
    const os = require('os');
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB',
      hostname: os.hostname(),
      uptime: Math.round(os.uptime() / 3600) + 'h',
    };
  } catch {
    return {};
  }
});

// Window controls
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
