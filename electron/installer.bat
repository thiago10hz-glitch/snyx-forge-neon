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
echo     SNYX OPTIMIZER - INSTALADOR v3.0
echo  ==========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo.
    echo Baixe e instale o Node.js em: https://nodejs.org
    echo Depois execute este instalador novamente.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado: 
node --version

set "INSTALL_DIR=%USERPROFILE%\SnyX-Optimizer"
set "DESKTOP=%USERPROFILE%\Desktop"
set "SOURCE_DIR=%~dp0"

echo.
echo [1/5] Criando pasta de instalacao...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\electron" mkdir "%INSTALL_DIR%\electron"
if not exist "%INSTALL_DIR%\dist" mkdir "%INSTALL_DIR%\dist"
echo    [OK] %INSTALL_DIR%

echo [2/5] Copiando arquivos...
:: Copy dist folder
xcopy /s /e /y /q "%SOURCE_DIR%dist\*" "%INSTALL_DIR%\dist\" >nul 2>&1
:: Copy electron folder  
xcopy /s /e /y /q "%SOURCE_DIR%electron\*" "%INSTALL_DIR%\electron\" >nul 2>&1
:: Copy the electron package.json as root package.json
copy /y "%SOURCE_DIR%electron\package.json" "%INSTALL_DIR%\package.json" >nul 2>&1
echo    [OK] Arquivos copiados

echo [3/5] Instalando Electron...
cd /d "%INSTALL_DIR%"
call npm install 2>&1
if %errorlevel% neq 0 (
    echo    [AVISO] Tentando instalar novamente...
    call npm install electron --save 2>&1
)
echo    [OK] Electron instalado

echo [4/5] Criando atalho na area de trabalho...
:: Create launcher bat
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo start "" /min cmd /c "npx electron . 2>nul"
) > "%INSTALL_DIR%\SnyX-Optimizer.bat"

:: Create desktop shortcut
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\SnyX Optimizer.lnk'); $s.TargetPath = '%INSTALL_DIR%\SnyX-Optimizer.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'SnyX Optimizer'; $s.WindowStyle = 7; $s.Save()" >nul 2>&1
echo    [OK] Atalho criado na area de trabalho

echo [5/5] Criando desinstalador...
(
echo @echo off
echo chcp 65001 ^>nul
echo title SnyX Optimizer - Desinstalador
echo color 0E
echo echo.
echo echo  Desinstalando SnyX Optimizer...
echo echo.
echo del "%DESKTOP%\SnyX Optimizer.lnk" 2^>nul
echo rmdir /s /q "%INSTALL_DIR%" 2^>nul
echo echo.
echo echo  [OK] SnyX Optimizer desinstalado!
echo pause
) > "%INSTALL_DIR%\Desinstalar-SnyX.bat"
echo    [OK] Desinstalador criado

echo.
echo  ==========================================
echo    INSTALACAO CONCLUIDA COM SUCESSO!
echo  ==========================================
echo.
echo  Local: %INSTALL_DIR%
echo  Atalho: Area de Trabalho
echo.
echo  Abrindo SnyX Optimizer...
cd /d "%INSTALL_DIR%"
start "" cmd /c "npx electron ."
echo.
pause
