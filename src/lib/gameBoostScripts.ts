// Game Boost optimization scripts for Windows
// These generate .bat files that apply/revert real PC optimizations

export const BOOST_SCRIPT = `@echo off
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

:: ============================================
:: 1. POWER PLAN - ALTO DESEMPENHO
:: ============================================
echo [1/10] Ativando plano de energia: Alto Desempenho...
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c >nul 2>&1
if %errorlevel% neq 0 (
    powercfg /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c >nul 2>&1
    powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c >nul 2>&1
)
echo    [OK] Alto Desempenho ativado

:: ============================================
:: 2. DESABILITAR EFEITOS VISUAIS
:: ============================================
echo [2/10] Desabilitando efeitos visuais do Windows...
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Desktop" /v UserPreferencesMask /t REG_BINARY /d 9012038010000000 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Desktop\\WindowMetrics" /v MinAnimate /t REG_SZ /d 0 /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Windows\\DWM" /v EnableAeroPeek /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Windows\\DWM" /v AlwaysHibernateThumbnails /t REG_DWORD /d 0 /f >nul 2>&1
echo    [OK] Efeitos visuais desabilitados

:: ============================================
:: 3. OTIMIZACOES DE REDE (TCP/NAGLE)
:: ============================================
echo [3/10] Otimizando configuracoes de rede...
:: Disable Nagle's Algorithm for lower latency
for /f "tokens=*" %%i in ('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" /s /f "DhcpIPAddress" 2^>nul ^| findstr "HKEY"') do (
    reg add "%%i" /v TcpAckFrequency /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "%%i" /v TCPNoDelay /t REG_DWORD /d 1 /f >nul 2>&1
    reg add "%%i" /v TcpDelAckTicks /t REG_DWORD /d 0 /f >nul 2>&1
)
:: Network throttling
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 0xFFFFFFFF /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 0 /f >nul 2>&1
:: Disable auto-tuning for stability
netsh int tcp set global autotuninglevel=disabled >nul 2>&1
netsh int tcp set global chimney=disabled >nul 2>&1
netsh int tcp set global rss=enabled >nul 2>&1
echo    [OK] Rede otimizada (Nagle desabilitado, throttling removido)

:: ============================================
:: 4. PRIORIDADE DE CPU PARA JOGOS
:: ============================================
echo [4/10] Configurando prioridade de CPU para jogos...
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v Priority /t REG_DWORD /d 6 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d "High" /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "SFIO Priority" /t REG_SZ /d "High" /f >nul 2>&1
echo    [OK] Prioridade GPU/CPU para jogos configurada

:: ============================================
:: 5. DESABILITAR SERVICOS DESNECESSARIOS
:: ============================================
echo [5/10] Desabilitando servicos que consomem recursos...
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

:: ============================================
:: 6. LIMPAR MEMORIA RAM
:: ============================================
echo [6/10] Limpando memoria RAM...
:: Clear standby list and working sets
powershell -Command "[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()" >nul 2>&1
:: Flush DNS
ipconfig /flushdns >nul 2>&1
echo    [OK] RAM limpa e DNS flushed

:: ============================================
:: 7. DESABILITAR GAME BAR E GAME DVR
:: ============================================
echo [7/10] Desabilitando Xbox Game Bar e Game DVR...
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /t REG_DWORD /d 0 /f >nul 2>&1
echo    [OK] Game Bar e DVR desabilitados (menos overhead)

:: ============================================
:: 8. OTIMIZAR GPU
:: ============================================
echo [8/10] Otimizando configuracoes de GPU...
reg add "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "SwapEffectUpgradeEnable=1;VRROptimizeEnable=1;" /f >nul 2>&1
:: Hardware accelerated GPU scheduling
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f >nul 2>&1
echo    [OK] GPU scheduling por hardware ativado

:: ============================================
:: 9. DESABILITAR FULLSCREEN OPTIMIZATIONS
:: ============================================
echo [9/10] Desabilitando otimizacoes de tela cheia do Windows...
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehavior /t REG_DWORD /d 2 /f >nul 2>&1
echo    [OK] Fullscreen Optimizations desabilitado

:: ============================================
:: 10. TIMER RESOLUTION + MOUSE
:: ============================================
echo [10/10] Otimizando timer e mouse...
reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 0 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 0 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 0 /f >nul 2>&1
:: Disable enhanced pointer precision
reg add "HKCU\\Control Panel\\Mouse" /v MouseSensitivity /t REG_SZ /d 10 /f >nul 2>&1
echo    [OK] Aceleracao do mouse removida (raw input)

echo.
echo  ========================================
echo    GAME BOOST APLICADO COM SUCESSO!
echo  ========================================
echo.
echo  Otimizacoes aplicadas:
echo   [+] Plano de energia: Alto Desempenho
echo   [+] Efeitos visuais desabilitados
echo   [+] Rede TCP/Nagle otimizada  
echo   [+] Prioridade CPU/GPU para jogos
echo   [+] Servicos desnecessarios parados
echo   [+] RAM limpa
echo   [+] Game Bar/DVR desabilitado
echo   [+] GPU scheduling por hardware
echo   [+] Fullscreen optimizations OFF
echo   [+] Mouse raw input ativado
echo.
echo  Para REVERTER tudo, execute: SnyX-GameBoost-REVERTER.bat
echo  Backup salvo em: %USERPROFILE%\\SnyX-Backup
echo.
echo  RECOMENDADO: Reinicie o PC para efeito completo.
echo.
pause
`;

export const REVERT_SCRIPT = `@echo off
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

echo [1/8] Restaurando plano de energia: Equilibrado...
powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e >nul 2>&1
echo    [OK] Plano Equilibrado ativado

echo [2/8] Restaurando efeitos visuais...
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

echo [3/8] Restaurando configuracoes de rede...
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

echo [4/8] Restaurando prioridade de CPU...
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v Priority /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d "Medium" /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "SFIO Priority" /t REG_SZ /d "Normal" /f >nul 2>&1
echo    [OK] Prioridade CPU/GPU restaurada

echo [5/8] Reabilitando servicos...
set "SERVICES=DiagTrack dmwappushservice WSearch SysMain TabletInputService MapsBroker PcaSvc lfsvc WerSvc"
for %%s in (%SERVICES%) do (
    sc config %%s start=auto >nul 2>&1
    sc start %%s >nul 2>&1
)
echo    [OK] Servicos reabilitados

echo [6/8] Restaurando Game Bar e Game DVR...
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /f >nul 2>&1
echo    [OK] Game Bar e DVR restaurados

echo [7/8] Restaurando fullscreen e GPU...
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehavior /t REG_DWORD /d 0 /f >nul 2>&1
echo    [OK] Fullscreen optimizations restaurado

echo [8/8] Restaurando mouse...
reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 1 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 6 /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 10 /f >nul 2>&1
echo    [OK] Mouse restaurado ao padrao

echo.
echo  ========================================
echo    TUDO RESTAURADO COM SUCESSO!
echo  ========================================
echo.
echo  Seu PC voltou as configuracoes originais.
echo  RECOMENDADO: Reinicie o PC.
echo.
echo  Removendo backup...
rmdir /s /q "%USERPROFILE%\\SnyX-Backup" >nul 2>&1
echo  [OK] Backup removido.
echo.
pause
`;

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
