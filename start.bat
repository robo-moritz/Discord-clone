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
    echo   X Node.js wurde in diesem Fenster nicht gefunden.
    echo     Falls Node.js schon installiert ist: schliesse dieses Fenster
    echo     und oeffne start.bat ERNEUT per Doppelklick
    echo     ^(sonst sieht das alte Fenster die neue Installation nicht^).
    echo     Falls nicht installiert: https://nodejs.org/de ^(LTS^) laden,
    echo     installieren, dann start.bat erneut doppelklicken.
    pause
    exit /b 1
)
for /f "delims=" %%V in ('node -v') do echo   Node.js %%V gefunden.
if not exist "node_modules\better-sqlite3" (
    echo   Installiere Server-Pakete... das kann 1-2 Minuten dauern.
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo   X npm install fehlgeschlagen - bitte Internet pruefen und erneut starten.
        pause
        exit /b 1
    )
) else (
    echo   Server-Pakete vorhanden.
)
if not exist "client\node_modules\vite" (
    echo   Installiere Client-Pakete...
    pushd client
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo   X npm install ^(client^) fehlgeschlagen.
        pause
        exit /b 1
    )
    popd
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
