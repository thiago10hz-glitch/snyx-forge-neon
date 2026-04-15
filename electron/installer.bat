@echo off
chcp 65001 >nul
title SnyX Optimizer - Instalador
color 0C

echo.
echo  ███████╗███╗   ██╗██╗   ██╗██╗  ██╗
echo  ██╔════╝████╗  ██║╚██╗ ██╔╝╚██╗██╔╝
echo  ███████╗██╔██╗ ██║ ╚████╔╝  ╚███╔╝ 
echo  ╚════██║██║╚██╗██║  ╚██╔╝   ██╔██╗ 
echo  ███████║██║ ╚████║   ██║   ██╔╝ ██╗
echo  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝
echo.
echo  ==========================================
echo     SNYX OPTIMIZER - INSTALADOR v2.0
echo  ==========================================
echo.

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Execute como Administrador!
    echo Clique com botao direito ^> Executar como administrador
    pause
    exit /b 1
)

set "INSTALL_DIR=%USERPROFILE%\SnyX-Optimizer"
set "APP_DIR=%INSTALL_DIR%\App"
set "DESKTOP=%USERPROFILE%\Desktop"

echo [1/5] Criando pasta de instalacao...
mkdir "%INSTALL_DIR%" 2>nul
mkdir "%APP_DIR%" 2>nul
echo    [OK] %INSTALL_DIR%

echo [2/5] Copiando arquivos do aplicativo...
:: Copy all app files from current directory
xcopy /s /e /y "%~dp0SnyX-Optimizer-win32-x64\*" "%APP_DIR%\" >nul 2>&1
if %errorlevel% neq 0 (
    echo    [AVISO] Copiando do diretorio atual...
    xcopy /s /e /y "%~dp0*" "%APP_DIR%\" >nul 2>&1
)
echo    [OK] Arquivos copiados

echo [3/5] Criando atalho na area de trabalho...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\SnyX Optimizer.lnk'); $s.TargetPath = '%APP_DIR%\SnyX-Optimizer.exe'; $s.WorkingDirectory = '%APP_DIR%'; $s.Description = 'SnyX Optimizer - Otimizacao de PC'; $s.Save()" >nul 2>&1
echo    [OK] Atalho criado na area de trabalho

echo [4/5] Criando desinstalador...
(
echo @echo off
echo chcp 65001 ^>nul
echo title SnyX Optimizer - Desinstalador
echo color 0E
echo.
echo echo  Desinstalando SnyX Optimizer...
echo echo.
echo echo [1/4] Revertendo otimizacoes...
echo if exist "%INSTALL_DIR%\revert-all.bat" call "%INSTALL_DIR%\revert-all.bat"
echo echo [2/4] Removendo VPN...
echo wireguard /uninstalltunnelservice snyx-vpn 2^>nul
echo echo [3/4] Limpando rede...
echo ipconfig /flushdns
echo netsh winsock reset
echo netsh int ip reset
echo echo [4/4] Removendo arquivos...
echo del "%DESKTOP%\SnyX Optimizer.lnk" 2^>nul
echo rmdir /s /q "%INSTALL_DIR%" 2^>nul
echo echo.
echo echo  [OK] SnyX Optimizer desinstalado com sucesso!
echo echo  Reinicie o PC para completar a limpeza.
echo pause
) > "%INSTALL_DIR%\Desinstalar-SnyX.bat"
echo    [OK] Desinstalador criado

echo [5/5] Registrando no sistema...
:: Add to Windows Apps
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\SnyXOptimizer" /v DisplayName /t REG_SZ /d "SnyX Optimizer" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\SnyXOptimizer" /v UninstallString /t REG_SZ /d "%INSTALL_DIR%\Desinstalar-SnyX.bat" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\SnyXOptimizer" /v InstallLocation /t REG_SZ /d "%INSTALL_DIR%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\SnyXOptimizer" /v Publisher /t REG_SZ /d "SnyX Team" /f >nul 2>&1
echo    [OK] Registrado no sistema

echo.
echo  ==========================================
echo    INSTALACAO CONCLUIDA COM SUCESSO!
echo  ==========================================
echo.
echo  Local: %INSTALL_DIR%
echo  Atalho: Area de Trabalho
echo.
echo  Para desinstalar: %INSTALL_DIR%\Desinstalar-SnyX.bat
echo.
echo  Abrindo SnyX Optimizer...
start "" "%APP_DIR%\SnyX-Optimizer.exe"
echo.
pause
