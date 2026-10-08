@echo off
rem ============================================================
rem  BlurChat Launcher - startet & aktualisiert die App aus Git
rem  Aufruf:  start.bat          -> pull, install, build, run
rem           start.bat dev      -> Dev-Modus (Hot Reload)
rem           start.bat update   -> nur aktualisieren + bauen
rem           start.bat stop     -> Server beenden
rem ============================================================
setlocal
cd /d "%~dp0"
title BlurChat

if "%1"=="stop" goto :stop
if "%1"=="dev"  goto :dev
if "%1"=="update" goto :build

:run
echo.
echo [1/4] Aktualisiere Repo (git pull)...
where git >nul 2>nul
if errorlevel 1 (
    echo   ! Git nicht gefunden - ueberspringe Update.
    echo     Installiere Git: https://git-scm.com/download/win
) else (
    git pull --ff-only
)

:install
echo.
echo [2/4] Pruefe Abhaengigkeiten...
where node >nul 2>nul
if errorlevel 1 (
    echo   X Node.js ist nicht installiert!
    echo     Bitte herunterladen von https://nodejs.org/de (LTS-Version)
    echo     ...dann diese Datei erneut doppelklicken.
    pause
    exit /b 1
)
call :need_install package.json node_modules
if "%NEED%"=="1" (
    echo   Installiere Server-Pakete...
    call npm install --no-audit --no-fund
)
call :need_install client\package.json client\node_modules
if "%NEED%"=="1" (
    echo   Installiere Client-Pakete...
    pushd client
    call npm install --no-audit --no-fund
    popd
)

:build
echo.
echo [3/4] Baue Client...
pushd client
call npm run build
popd

echo.
echo [4/4] Starte BlurChat...
echo   (Fenster offen lassen - Strg+C oder "start.bat stop" zum Beenden)
echo.
node server\index.js
goto :eof

:dev
echo [Dev] Server mit Auto-Restart + Vite Hot-Reload auf http://localhost:5173
call npm run dev
goto :eof

:stop
taskkill /f /im node.exe >nul 2>nul
echo BlurChat gestoppt.
goto :eof

rem ------------------------------------------------------------
rem Hilfsfunktion: NEED=1 wenn package.json neuer als node_modules
rem ------------------------------------------------------------
:need_install
set NEED=1
if not exist "%~2" goto :eof
for %%A in ("%~1") do set "SRC=%%~tA"
for %%B in ("%~2") do set "DST=%%~tB"
if "%SRC%" LEQ "%DST%" set NEED=0
goto :eof
