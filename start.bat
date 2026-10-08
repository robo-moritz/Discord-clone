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
if not exist "node_modules\better-sqlite3" (
    echo   Installiere Server-Pakete... das kann 1-2 Minuten dauern.
    call npm install --no-audit --no-fund
    if not exist "node_modules\better-sqlite3" (
        echo   X Server-Installation fehlgeschlagen!
        pause
        exit /b 1
    )
) else (
    echo   Server-Pakete vorhanden.
)
if not exist "client\node_modules\vite" (
    echo   Installiere Client-Pakete... das kann 1-2 Minuten dauern.
    pushd client
    call npm install --no-audit --no-fund
    popd
    if not exist "client\node_modules\vite" (
        echo   X Client-Installation fehlgeschlagen!
        pause
        exit /b 1
    )
) else (
    echo   Client-Pakete vorhanden.
)

:build
echo.
echo [3/4] Baue Client...
pushd client
call npm run build
if errorlevel 1 (
    echo   X Client-Build fehlgeschlagen!
    popd
    pause
    exit /b 1
)
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
