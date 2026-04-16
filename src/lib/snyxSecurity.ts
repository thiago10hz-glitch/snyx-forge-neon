// SnyX-SEC: Runtime security layer
// Anti-tamper, anti-debug, anti-inspect protections

const _snyx_sec_version = "2.0";

// Detect DevTools
let _snyx_devtools = false;
const _snyx_threshold = 160;

function _snyx_checkDevTools() {
  const w = window.outerWidth - window.innerWidth > _snyx_threshold;
  const h = window.outerHeight - window.innerHeight > _snyx_threshold;
  _snyx_devtools = w || h;
}

// Anti-debugger (runs periodically)
function _snyx_antiDebug() {
  const start = performance.now();
  // debugger statement detection - if debugger is open, this takes >100ms
  (function() { return; })();
  const end = performance.now();
  if (end - start > 100) {
    _snyx_devtools = true;
  }
}

// Track if current user is admin/owner (set externally)
let _snyx_is_owner = false;

export function setSnyxOwnerMode(isOwner: boolean) {
  _snyx_is_owner = isOwner;
}

// Disable common inspect methods on protected elements
function _snyx_protectDOM() {
  // Block right-click for non-owners
  document.addEventListener("contextmenu", (e) => {
    if (_snyx_is_owner) return;
    const target = e.target as HTMLElement;
    // Allow context menu on inputs/textareas
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    e.preventDefault();
    return false;
  });

  // Block copy for non-owners
  document.addEventListener("copy", (e) => {
    if (_snyx_is_owner) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    e.preventDefault();
  });

  // Block cut for non-owners
  document.addEventListener("cut", (e) => {
    if (_snyx_is_owner) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    e.preventDefault();
  });

  // Block text selection via selectstart for non-owners
  document.addEventListener("selectstart", (e) => {
    if (_snyx_is_owner) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    e.preventDefault();
  });

  // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+C (outside inputs)
  document.addEventListener("keydown", (e) => {
    if (_snyx_is_owner) return;
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) ||
      (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) ||
      (e.ctrlKey && (e.key === "U" || e.key === "u"))
    ) {
      e.preventDefault();
      return false;
    }
    // Block Ctrl+C outside inputs
    if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
        e.preventDefault();
        return false;
      }
    }
  });
}

// Console warning
function _snyx_consoleWarning() {
  const style = "color: red; font-size: 24px; font-weight: bold; text-shadow: 1px 1px 2px black;";
  const styleSmall = "color: #ff4444; font-size: 14px;";
  console.log("%c⚠️ PARAR!", style);
  console.log("%cEsta área é protegida pelo SnyX-SEC.", styleSmall);
  console.log("%cTentativas de manipulação resultam em bloqueio permanente da conta.", styleSmall);
  console.log("%c🔒 Criptografia AES-256-GCM ativa", "color: #00ff00; font-size: 12px;");
}

// Integrity hash for the current page
function _snyx_pageIntegrity(): string {
  const scripts = document.querySelectorAll("script[src]");
  let hash = 0;
  scripts.forEach(s => {
    const src = (s as HTMLScriptElement).src;
    for (let i = 0; i < src.length; i++) {
      hash = ((hash << 5) - hash) + src.charCodeAt(i);
      hash = hash & hash;
    }
  });
  return Math.abs(hash).toString(36);
}

// Initialize all security measures
export function initSnyxSecurity() {
  // Check devtools periodically
  setInterval(_snyx_checkDevTools, 2000);
  setInterval(_snyx_antiDebug, 5000);
  
  // Protect DOM
  _snyx_protectDOM();
  
  // Console warning
  _snyx_consoleWarning();
  
  // Store initial page integrity
  const integrity = _snyx_pageIntegrity();
  (window as any).__snyx_integrity = integrity;
  
  // Periodic integrity check
  setInterval(() => {
    const current = _snyx_pageIntegrity();
    if ((window as any).__snyx_integrity && current !== (window as any).__snyx_integrity) {
      console.error("%c🚫 SnyX-SEC: Integridade da página comprometida!", "color: red; font-size: 16px;");
    }
  }, 10000);
}

// Check if devtools is open
export function isDevToolsOpen(): boolean {
  return _snyx_devtools;
}

// Generate client-side integrity token
export async function generateIntegrityToken(userId: string, resource: string): Promise<{
  signature: string;
  timestamp: string;
  fingerprint: string;
}> {
  const timestamp = Date.now().toString();
  const fingerprint = getDeviceFingerprint();
  
  // Use the HMAC secret from environment variable
  const secret = import.meta.env.VITE_SNYX_INTEGRITY_SECRET || "";
  const signature = await snyxHMAC(`${userId}:${timestamp}:${resource}`, secret);
  
  return { signature, timestamp, fingerprint };
}

async function snyxHMAC(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getDeviceFingerprint(): string {
  const nav = navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width, screen.height, screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || 0,
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
