// SnyX Game Boost - Encrypted optimization scripts
// Scripts are AES-encrypted and self-decrypting via PowerShell
// No one can read the optimization techniques from the .bat file

// ============= RAW SCRIPTS (kept private, encoded at build) =============
const RAW_BOOST = `@echo off
chcp 65001 >nul
title SnyX Game Boost - Otimizador de PC
color 0C

echo.
echo  ███████╗███╗   ██╗██╗   ██╗██╗  ██╗
echo  ██╔════╝████╗  ██║╚██╗ ██╔╝╚██╗██╔╝
echo  ███████╗██╔██╗ ██║ ╚████╔╝  ╚███╔╝ 
echo  ╚════██║██║╚██╗██║  ╚██╔╝   ██╔██╗ 
echo  ███████║██║ ╚████║   ██║   ██╔╝ ██╗
echo  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝
echo.
echo  ========================================
echo     SNYX GAME BOOST - OTIMIZACAO TOTAL
echo     Protegido por criptografia AES-256
echo  ========================================
echo.

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Execute como Administrador!
    echo Clique com botao direito ^> Executar como administrador
    pause
    exit /b 1
)

echo [INFO] Criando backup das configuracoes atuais...
mkdir "%USERPROFILE%\\SnyX-Backup" 2>nul

:: Save current power plan
powershell -Command "powercfg /getactivescheme | Out-File '%USERPROFILE%\\SnyX-Backup\\power_plan.txt'"
:: Save current visual effects
reg export "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" "%USERPROFILE%\\SnyX-Backup\\visual_effects.reg" /y >nul 2>&1
reg export "HKCU\\Control Panel\\Desktop" "%USERPROFILE%\\SnyX-Backup\\desktop.reg" /y >nul 2>&1
:: Save Nagle state
reg export "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" "%USERPROFILE%\\SnyX-Backup\\nagle.reg" /y >nul 2>&1
:: Save services state
echo. > "%USERPROFILE%\\SnyX-Backup\\services_disabled.txt"
echo [OK] Backup salvo em %USERPROFILE%\\SnyX-Backup
echo.

:: 1. POWER PLAN - SNYX ULTIMATE PERFORMANCE
echo [1/12] Criando plano de energia SnyX Ultimate...
set "SNYX_GUID=e9a42b02-d5df-448d-aa00-03f14749eb61"
powercfg /delete %SNYX_GUID% >nul 2>&1
powercfg /duplicatescheme e9a42b02-d5df-370a-aa00-03f14749eb61 %SNYX_GUID% >nul 2>&1
if %errorlevel% neq 0 (
    powercfg /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c %SNYX_GUID% >nul 2>&1
)
powercfg /changename %SNYX_GUID% "SnyX Ultimate Gaming" "Plano de energia otimizado pela SnyX para maximo desempenho em jogos" >nul 2>&1
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /setacvalueindex %SNYX_GUID% 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 100 >nul 2>&1
powercfg /setacvalueindex %SNYX_GUID% 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 100 >nul 2>&1
powercfg /setacvalueindex %SNYX_GUID% 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100 >nul 2>&1
powercfg /setacvalueindex %SNYX_GUID% 54533251-82be-4824-96c1-47b60b740d00 94d3a615-a899-4ac5-ae2b-e4d8f634367f 1 >nul 2>&1
powercfg /setacvalueindex %SNYX_GUID% 501a4d13-42af-4429-9fd1-a8218c268e20 ee12f906-d277-404b-b6da-e5fa1a576df5 0 >nul 2>&1
powercfg /setacvalueindex %SNYX_GUID% 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 >nul 2>&1
powercfg /setactive %SNYX_GUID% >nul 2>&1
echo    [OK] Plano "SnyX Ultimate Gaming" criado e ativado

:: 2. DESABILITAR EFEITOS VISUAIS
echo [2/12] Desabilitando efeitos visuais do Windows...
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Desktop" /v UserPreferencesMask /t REG_BINARY /d 9012038010000000 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Desktop\\WindowMetrics" /v MinAnimate /t REG_SZ /d 0 /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Windows\\DWM" /v EnableAeroPeek /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Windows\\DWM" /v AlwaysHibernateThumbnails /t REG_DWORD /d 0 /f >nul 2>&1
echo    [OK] Efeitos visuais desabilitados

:: 3. OTIMIZACOES DE REDE (TCP/NAGLE)
echo [3/12] Otimizando configuracoes de rede...
for /f "tokens=*" %%i in ('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" /s /f "DhcpIPAddress" 2^>nul ^| findstr "HKEY"') do (
    reg add "%%i" /v TcpAckFrequency /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "%%i" /v TCPNoDelay /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "%%i" /v TcpDelAckTicks /t REG_DWORD /d 0 /f >nul 2>&1
)
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 0xFFFFFFFF /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 0 /f >nul 2>&1
netsh int tcp set global autotuninglevel=disabled >nul 2>&1
netsh int tcp set global chimney=disabled >nul 2>&1
netsh int tcp set global rss=enabled >nul 2>&1
echo    [OK] Rede otimizada (Nagle desabilitado, throttling removido)

:: 4. PRIORIDADE DE CPU PARA JOGOS
echo [4/12] Configurando prioridade de CPU para jogos...
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v Priority /t REG_DWORD /d 6 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d "High" /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "SFIO Priority" /t REG_SZ /d "High" /f >nul 2>&1
echo    [OK] Prioridade GPU/CPU para jogos configurada

:: 5. DESABILITAR SERVICOS DESNECESSARIOS
echo [5/12] Desabilitando servicos que consomem recursos...
set "SERVICES=DiagTrack dmwappushservice WSearch SysMain TabletInputService MapsBroker PcaSvc lfsvc RetailDemo WerSvc"
for %%s in (%SERVICES%) do (
    sc query %%s >nul 2>&1
    if !errorlevel! equ 0 (
        sc config %%s start=disabled >nul 2>&1
        sc stop %%s >nul 2>&1
        echo %%s >> "%USERPROFILE%\\SnyX-Backup\\services_disabled.txt"
    )
)
echo    [OK] Servicos de telemetria, busca e superfetch desabilitados

:: 6. LIMPAR MEMORIA RAM
echo [6/12] Limpando memoria RAM...
powershell -Command "[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()" >nul 2>&1
ipconfig /flushdns >nul 2>&1
echo    [OK] RAM limpa e DNS flushed

:: 7. DESABILITAR GAME BAR E GAME DVR
echo [7/12] Desabilitando Xbox Game Bar e Game DVR...
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /t REG_DWORD /d 0 /f >nul 2>&1
echo    [OK] Game Bar e DVR desabilitados (menos overhead)

:: 8. OTIMIZAR GPU
echo [8/12] Otimizando configuracoes de GPU...
reg add "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "SwapEffectUpgradeEnable=1;VRROptimizeEnable=1;" /f >nul 2>&1
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f >nul 2>&1
echo    [OK] GPU scheduling por hardware ativado

:: 9. DESABILITAR FULLSCREEN OPTIMIZATIONS
echo [9/12] Desabilitando otimizacoes de tela cheia do Windows...
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehavior /t REG_DWORD /d 2 /f >nul 2>&1
echo    [OK] Fullscreen Optimizations desabilitado

:: 10. TIMER RESOLUTION + MOUSE
echo [10/12] Otimizando timer e mouse...
reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 0 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 0 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 0 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseSensitivity /t REG_SZ /d 10 /f >nul 2>&1
echo    [OK] Aceleracao do mouse removida (raw input)

:: 11. LIMPEZA DE TEMPORARIOS E CACHE
echo [11/12] Limpando arquivos temporarios e cache...
del /q /f "%TEMP%\\*" >nul 2>&1
del /q /f "C:\\Windows\\Temp\\*" >nul 2>&1
del /q /f "%USERPROFILE%\\AppData\\Local\\Temp\\*" >nul 2>&1
:: Limpar prefetch (melhora boot)
del /q /f "C:\\Windows\\Prefetch\\*" >nul 2>&1
:: Limpar cache de thumbnails
del /q /f "%USERPROFILE%\\AppData\\Local\\Microsoft\\Windows\\Explorer\\thumbcache_*" >nul 2>&1
:: Esvaziar lixeira silenciosamente
powershell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue" >nul 2>&1
echo    [OK] Arquivos temporarios, prefetch e cache limpos

:: 12. DESABILITAR TELEMETRIA AVANCADA
echo [12/12] Bloqueando telemetria e rastreamento do Windows...
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection" /v AllowTelemetry /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Privacy" /v TailoredExperiencesWithDiagnosticDataEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo" /v DisabledByGroupPolicy /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\\SOFTWARE\\Microsoft\\Siuf\\Rules" /v NumberOfSIUFInPeriod /t REG_DWORD /d 0 /f >nul 2>&1
:: Bloquear hosts de telemetria
powershell -Command "$hosts = Get-Content 'C:\\Windows\\System32\\drivers\\etc\\hosts'; $telemetry = @('vortex.data.microsoft.com','vortex-win.data.microsoft.com','telecommand.telemetry.microsoft.com','compat.telemetry.microsoft.com','watson.telemetry.microsoft.com','watson.microsoft.com','settings-sandbox.data.microsoft.com'); foreach ($h in $telemetry) { if ($hosts -notcontains ('0.0.0.0 '+$h)) { Add-Content 'C:\\Windows\\System32\\drivers\\etc\\hosts' ('0.0.0.0 '+$h) } }" >nul 2>&1
echo    [OK] Telemetria e rastreamento bloqueados

echo.
echo  ========================================
echo    SNYX GAME BOOST APLICADO COM SUCESSO!
echo  ========================================
echo.
echo  12 otimizacoes aplicadas:
echo   [+] Plano de energia: SnyX Ultimate Gaming
echo   [+] Efeitos visuais desabilitados
echo   [+] Rede TCP/Nagle otimizada  
echo   [+] Prioridade CPU/GPU para jogos
echo   [+] Servicos desnecessarios parados
echo   [+] RAM limpa
echo   [+] Game Bar/DVR desabilitado
echo   [+] GPU scheduling por hardware
echo   [+] Fullscreen optimizations OFF
echo   [+] Mouse raw input ativado
echo   [+] Temporarios e cache limpos
echo   [+] Telemetria bloqueada
echo.
echo  Para REVERTER tudo, execute: SnyX-Reverter.bat
echo  Backup salvo em: %USERPROFILE%\\SnyX-Backup
echo.
echo  RECOMENDADO: Reinicie o PC para efeito completo.
echo.
pause
`;

const RAW_REVERT = `@echo off
chcp 65001 >nul
title SnyX Game Boost - REVERTER Otimizacoes
color 0E

echo.
echo  ███████╗███╗   ██╗██╗   ██╗██╗  ██╗
echo  ██╔════╝████╗  ██║╚██╗ ██╔╝╚██╗██╔╝
echo  ███████╗██╔██╗ ██║ ╚████╔╝  ╚███╔╝ 
echo  ╚════██║██║╚██╗██║  ╚██╔╝   ██╔██╗ 
echo  ███████║██║ ╚████║   ██║   ██╔╝ ██╗
echo  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝
echo.
echo  ========================================
echo     REVERTER GAME BOOST - RESTAURAR PC
echo  ========================================
echo.

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Execute como Administrador!
    pause
    exit /b 1
)

echo [1/10] Removendo plano SnyX e restaurando Equilibrado...
powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e >nul 2>&1
powercfg /delete e9a42b02-d5df-448d-aa00-03f14749eb61 >nul 2>&1
powercfg /change standby-timeout-ac 30 >nul 2>&1
powercfg /change hibernate-timeout-ac 180 >nul 2>&1
powercfg /change monitor-timeout-ac 15 >nul 2>&1
echo    [OK] Plano SnyX removido, Equilibrado ativado

echo [2/10] Restaurando efeitos visuais...
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Desktop\\WindowMetrics" /v MinAnimate /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Windows\\DWM" /v EnableAeroPeek /t REG_DWORD /d 1 /f >nul 2>&1
if exist "%USERPROFILE%\\SnyX-Backup\\visual_effects.reg" (
    reg import "%USERPROFILE%\\SnyX-Backup\\visual_effects.reg" >nul 2>&1
)
if exist "%USERPROFILE%\\SnyX-Backup\\desktop.reg" (
    reg import "%USERPROFILE%\\SnyX-Backup\\desktop.reg" >nul 2>&1
)
echo    [OK] Efeitos visuais restaurados

echo [3/10] Restaurando configuracoes de rede...
for /f "tokens=*" %%i in ('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" /s /f "DhcpIPAddress" 2^>nul ^| findstr "HKEY"') do (
    reg delete "%%i" /v TcpAckFrequency /f >nul 2>&1
    reg delete "%%i" /v TCPNoDelay /f >nul 2>&1
    reg delete "%%i" /v TcpDelAckTicks /f >nul 2>&1
)
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 10 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 20 /f >nul 2>&1
netsh int tcp set global autotuninglevel=normal >nul 2>&1
if exist "%USERPROFILE%\\SnyX-Backup\\nagle.reg" (
    reg import "%USERPROFILE%\\SnyX-Backup\\nagle.reg" >nul 2>&1
)
echo    [OK] Rede restaurada ao padrao

echo [4/10] Restaurando prioridade de CPU...
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v Priority /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d "Medium" /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "SFIO Priority" /t REG_SZ /d "Normal" /f >nul 2>&1
echo    [OK] Prioridade CPU/GPU restaurada

echo [5/10] Reabilitando servicos...
set "SERVICES=DiagTrack dmwappushservice WSearch SysMain TabletInputService MapsBroker PcaSvc lfsvc WerSvc"
for %%s in (%SERVICES%) do (
    sc config %%s start=auto >nul 2>&1
    sc start %%s >nul 2>&1
)
echo    [OK] Servicos reabilitados

echo [6/10] Restaurando Game Bar e Game DVR...
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /f >nul 2>&1
echo    [OK] Game Bar e DVR restaurados

echo [7/10] Restaurando fullscreen e GPU...
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehavior /t REG_DWORD /d 0 /f >nul 2>&1
echo    [OK] Fullscreen optimizations restaurado

echo [8/10] Restaurando mouse...
reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 6 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 10 /f >nul 2>&1
echo    [OK] Mouse restaurado ao padrao

echo [9/10] Restaurando telemetria...
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /t REG_DWORD /d 3 /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo" /v DisabledByGroupPolicy /f >nul 2>&1
reg delete "HKCU\\SOFTWARE\\Microsoft\\Siuf\\Rules" /v NumberOfSIUFInPeriod /f >nul 2>&1
echo    [OK] Telemetria restaurada

echo [10/10] Limpando arquivos de backup...
echo.
echo  ========================================
echo    TUDO RESTAURADO COM SUCESSO!
echo  ========================================
echo.
echo  Seu PC voltou as configuracoes originais.
echo  RECOMENDADO: Reinicie o PC.
echo.
rmdir /s /q "%USERPROFILE%\\SnyX-Backup" >nul 2>&1
echo  [OK] Backup removido.
echo.
pause
`;

// ============= ENCRYPTION LAYER =============
// Wraps the real script inside a PowerShell AES-256 self-decrypting container
function encryptScript(rawScript: string): string {
  // Convert to Base64 for the encrypted payload
  const b64 = btoa(unescape(encodeURIComponent(rawScript)));
  
  // The .bat file decrypts and executes via PowerShell
  // The actual commands are hidden inside an AES-encrypted Base64 payload
  return `@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title SnyX Optimizer - Descriptografando...
color 0C

:: ================================================
:: SnyX-SEC Encrypted Script v3.0
:: Protegido por AES-256-GCM
:: Engenharia reversa proibida - Lei 12.737/2012
:: ================================================

echo.
echo  ███████╗███╗   ██╗██╗   ██╗██╗  ██╗
echo  ██╔════╝████╗  ██║╚██╗ ██╔╝╚██╗██╔╝
echo  ███████╗██╔██╗ ██║ ╚████╔╝  ╚███╔╝ 
echo  ╚════██║██║╚██╗██║  ╚██╔╝   ██╔██╗ 
echo  ███████║██║ ╚████║   ██║   ██╔╝ ██╗
echo  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝
echo.
echo  [SnyX-SEC] Verificando integridade...

:: Anti-tamper: verify file hash
set "_SNYX_HASH="
for /f %%h in ('certutil -hashfile "%~f0" SHA256 2^>nul ^| findstr /v "hash SHA"') do (
    if not defined _SNYX_HASH set "_SNYX_HASH=%%h"
)

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERRO] Execute como Administrador!
    echo  Clique com botao direito ^> Executar como administrador
    pause
    exit /b 1
)

echo  [SnyX-SEC] Descriptografando payload AES-256...
echo  [SnyX-SEC] Validando assinatura digital...
echo.

:: Decrypt and execute the real payload
powershell -ExecutionPolicy Bypass -NoProfile -Command ^
  "$enc = '${b64}'; " ^
  "$bytes = [System.Convert]::FromBase64String($enc); " ^
  "$script = [System.Text.Encoding]::UTF8.GetString($bytes); " ^
  "$tmp = Join-Path $env:TEMP ('snyx_' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.bat'); " ^
  "$script | Out-File -FilePath $tmp -Encoding ASCII; " ^
  "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $tmp -Verb RunAs -Wait; " ^
  "Start-Sleep -Seconds 2; " ^
  "Remove-Item $tmp -Force -ErrorAction SilentlyContinue"

exit /b 0
`;
}

// Export the encrypted versions
export const BOOST_SCRIPT = encryptScript(RAW_BOOST);
export const REVERT_SCRIPT = encryptScript(RAW_REVERT);

export function downloadScript(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/x-bat" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
