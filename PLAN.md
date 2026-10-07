# 🗂️ Discord-Klon — Projektplan

## 1. Tech-Stack (bewusst "langweilig & robust")
| Bereich     | Wahl                     | Warum |
|-------------|--------------------------|-------|
| Backend     | Node.js + Express        | Weit verbreitet, einfach, läuft mit deinem Node 20 |
| Echtzeit    | WebSocket (ws)           | Kein Sticky-Session-Problem, voller Zugriff auf Protokoll |
| Datenbank   | SQLite (besser: `node:sqlite` / fallback `sql.js`) | Keine externer DB-Server nötig, eine Datei in `./data/` |
| Frontend    | Vite + React             | Schneller Dev-Server, schnelles Bauen; Build wird vom Server ausgeliefert |
| Auth        | Session-Cookie + scrypt (Node-Builtin) | Sichere Passwörter ohne native Dependencies |

> **Keine nativen Compile-Dependencies** (kein bcrypt/node-gyp) → `launch.sh` funktioniert überall mit Node ≥ 20.

## 2. Features (MVP → Vollausbau)
### Kern
- [ ] Registrierung / Login / Logout (Session-Cookie)
- [ ] Benutzerprofile: Anzeigename, Avatar-Farbe, Status-Bio
- [ ] Server ("Guilds") erstellen, joinen per Invite-Code, verlassen, löschen
- [ ] Kanäle (Text) in Kategorien, erstellen / umbenennen / löschen
- [ ] Rollen mit Farben + Berechtigungen (admin, kanäle verwalten, verbannen …)
- [ ] Mitgliederliste mit Online-Status & Rollenfarbe
- [ ] Textnachrichten senden, bearbeiten, löschen
- [ ] Reaktionen (Emoji), Antworten (Threads light), @-Erwähnungen
- [ ] Ungelesen-Markierung pro Kanal
- [ ] Persistenter Chatverlauf (SQLite)

### Extras
- [ ] Live-Schreibetipp-Indikator ("X tippt…")
- [ ] DMs / Direct Messages zwischen Nutzern
- [ ] Benachrichtigungen bei @-Mention (In-App + Browser-Notification)
- [ ] Emojis / Shortcodes (`:smile:` → 😄)
- [ ] Markdown-ähnliche Formatierung (`**fett**`, `` `code` ``, Links, Code-Blöcke)
- [ ] Suchfunktion in Nachrichten
- [ ] Nutzer verbannen / kicken (Moderation)
- [ ] Dark-Theme im Discord-Look

## 3. Verzeichnisstruktur
```
/workspace
├── launch.sh              # 👈 DEIN STARTER (starten + updaten)
├── start.bat              # Windows-Pendant
├── package.json           # Root: Scripts (dev/build/start/install)
├── server/                # Express + WebSocket + SQLite
│   ├── index.js
│   ├── db.js
│   ├── auth.js
│   └── ws.js
├── client/                # Vite + React UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── socket.js
│   │   └── components/…
│   └── index.html
├── data/                  # SQLite-Datei (gitignoriert)
└── PLAN.md                # diese Datei
```

## 4. Die `launch.sh` (Kern deines Wunsches)
Sie soll **ein Befehl für alles** sein und direkt aus dem Repo arbeiten:
```bash
./launch.sh            # Standard: aktualisieren → bauen → starten
./launch.sh dev        # Dev-Modus mit Hot-Reload (Vite HMR)
./launch.sh update     # nur git pull + npm install + rebuild
./launch.sh stop       # laufenden Server sauber beenden
```
Was sie automatisch macht:
1. `git pull` (falls Remote vorhanden & Änderungen da) → **immer aktuell aus dem Repo**
2. `npm install` (nur wenn `package-lock` neuer als `node_modules`)
3. Client bauen (`vite build`) → Server liefert statisch aus
4. Server starten auf `http://localhost:3000`
5. PID-File + Log in `./data/` für sauberen Stop/Neustart

## 5. Nächste Schritte
1. ✅ Plan bestätigen / anpassen
2. Grundgerüst (package.json, Ordner, launch.sh)
3. Backend: DB-Schema + Auth + REST
4. WebSocket: Nachrichten, Presence, Typing
5. Frontend: Layout + Komponenten
6. Extras & Feinschliff

---
**Offene Fragen an dich:**
1. Welche der "Extras" sind dir am wichtigsten? (z. B. DMs ja/nein?)
2. Soll die App öffentlich erreichbar sein (Multi-User übers Netz) oder eher lokal für dich?
3. Windows, macOS oder Linux als Zielrechner für `launch.sh`?
