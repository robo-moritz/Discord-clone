# BlurChat 🎙️

Discord-ähnliche Chat-App zum Selbst-Hosten: Server, Kanäle, DMs, Rollen, Reaktionen, Profile mit Banner – alles in Echtzeit per WebSocket, persistiert in SQLite.

## Schnellstart (Windows)

1. **Node.js LTS** installieren: <https://nodejs.org/de> (einmalig)
2. **Git** installieren: <https://git-scm.com/download/win> (einmalig, empfohlen fürs Auto-Update)
3. Repo klonen (in Git Bash oder Eingabeaufforderung):
   ```bat
   git clone <REPO-URL> blurchat
   cd blurchat
   ```
4. **`start.bat` doppelklicken** – das war's. Der Launcher macht automatisch:
   `git pull → npm install (nur bei Änderung) → Client-Build → Server-Start`

Danach im Browser öffnen: **http://localhost:3000**

### Weitere Befehle
| Befehl | Wirkung |
|---|---|
| `start.bat` | Normal starten + aktualisieren |
| `start.bat dev` | Entwickler-Modus mit Hot-Reload (http://localhost:5173) |
| `start.bat update` | Nur Repo ziehen + neu bauen |
| `start.bat stop` | Server beenden |

Unter Linux/macOS: `./launch.sh` (gleiche Modi).

## Mehrere Nutzer / im Netzwerk verwenden

Der Server lauscht auf Port **3000** an allen Netzwerkschnittstellen. Nach dem Start zeigt das Fenster alle Adressen an, z. B.:

```
│  Lokal:       http://localhost:3000
│  Im Netzwerk: http://192.168.1.42:3000
```

Andere im selben WLAN/LAN öffnen einfach die Netzwerk-Adresse, registrieren sich und treten per Invite-Code deinem Server bei. Falls Windows beim ersten Start eine Firewall-Abfrage zeigt → „Zugriff zulassen" klicken.

Damit andere dein Repo für `start.bat` nutzen können, push es auf GitHub/GitLab:
```bat
git remote add origin <REPO-URL>
git push -u origin main
```

## Features

- 🔐 Registrierung/Login (Session-Cookies, scrypt-Passwort-Hashing)
- 🏠 Server (Guilds) mit Invite-Codes & Rotieren
- 📝 Textkanäle mit Kategorien, Thema, Pinning
- 👥 Rollen mit Farben & Berechtigungen (Senden, Verwalten, Kicken, Bannen …)
- 💬 Nachrichten: senden, bearbeiten, löschen, Antworten, Reaktionen, @-Mentions
- ✍️ Markdown (**fett**, *kursiv*, `code`, Blöcke), >150 Emoji-Shortcodes (`:rocket:`)
- 🖼️ Datei-Uploads (Drag & Drop), Bildvorschau
- 🟢 Online-Status (online/abwesend/Nicht stören), „tippt…"-Anzeige
- 📬 Direktnachrichten (DMs) + Gruppen-DMs, Freunde
- 🔕 Ungelesen-Marker, Badges, Sound-Benachrichtigung
- 🔍 Nachrichtensuche mit Jump-to-Message
- 🧑‍🎨 Profil-Customization: Avatar-Upload, **Banner** (Bild oder Farbverlauf), Anzeigename, Pronomen, Bio, Akzentfarbe, Badges
- 🌗 Dark-/Light-Theme, 📱 Responsive (auch am Handy nutzbar)
- 🛡️ Moderation: Kick, Ban, Rechte verwalten
- ⚙️ Server-Einstellungen: Registrierung schließen, Name/Icon-Farbe

## Technik

| | |
|---|---|
| Backend | Node.js + Express + `ws` (WebSocket) |
| Datenbank | SQLite via `better-sqlite3` (eine Datei in `./data/`) |
| Frontend | React + Vite (Build wird vom Server ausgeliefert) |
| Auth | HttpOnly-Session-Cookie, Passwörter mit scrypt |

Daten liegen lokal in `data/blurchat.db` + `data/uploads/` – beim `git pull` nie überschrieben (in `.gitignore`).

## Projektstruktur

```
server/        API, WebSocket, DB, Auth
client/        React-App (Quellcode in src/)
start.bat      Launcher Windows (Doppelklick)
launch.sh      Launcher Linux/macOS
PLAN.md        Ausführlicher Projekt- & Designplan
data/          (lokal, git-ignored) Datenbank & Uploads
```
