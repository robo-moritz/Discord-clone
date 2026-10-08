# 🗂️ Discord-Klon — Projektplan

## 0. Festlegungen (von dir beantwortet)
1. **DMs:** JA — 1:1 und Gruppen-DMs sind fix eingeplant (M5).
2. **Nutzerkreis:** Mehrere Nutzer — App lauscht auf `0.0.0.0`, Zugriff im LAN ueber `http://DEINE-IP:3000` (Details in Kap. 3b).
3. **Ziel-OS:** Windows — `start.bat` ist der Haupt-Launcher (Doppelklick); `launch.sh` bleibt als Bonus fuer Git-Bash/Linux/Mac.


## 1. Tech-Stack (bewusst "langweilig & robust")
| Bereich     | Wahl                     | Warum |
|-------------|--------------------------|-------|
| Backend     | Node.js + Express        | Weit verbreitet, einfach, läuft mit deinem Node 20 |
| Echtzeit    | WebSocket (ws)           | Kein Sticky-Session-Problem, voller Zugriff auf Protokoll |
| Datenbank   | SQLite (`better-sqlite3`, vorkompilierte Binaries für Win/Linux/Mac) | Kein externer DB-Server, eine Datei in `./data/` |
| Frontend    | Vite + React             | Schneller Dev-Server, schnelles Bauen; Build wird vom Server ausgeliefert |
| Auth        | Session-Cookie + scrypt (Node-Builtin) | Sichere Passwörter ohne native Dependencies |

> **Keine nativen Compile-Dependencies** (kein bcrypt/node-gyp) → `launch.sh` funktioniert überall mit Node ≥ 20.

## 2. Features (MVP → Vollausbau)
### Kern
- [ ] Registrierung / Login / Logout (Session-Cookie)
- [ ] **Benutzerprofile (Fokus!)** — siehe Kap. 3c: Banner, Avatar, Farben, Bio, Pronomen, Badges, Theme & Profil-Editor mit Live-Vorschau
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
- [ ] **DMs / Direct Messages** (fix, wie gewünscht): 1:1 + Gruppen-DMs, im linken Rail unter dem Discord-Logo
- [ ] Benachrichtigungen bei @-Mention (In-App + Browser-Notification)
- [ ] Emojis / Shortcodes (`:smile:` → 😄)
- [ ] Markdown-ähnliche Formatierung (`**fett**`, `` `code` ``, Links, Code-Blöcke)
- [ ] Suchfunktion in Nachrichten
- [ ] Nutzer verbannen / kicken (Moderation)
- [ ] Dark-Theme im Discord-Look (+ optional Light-Mode-Toggle)
- [ ] **Avatar-Upload** (jpg/png, serverseitig auf 128px skaliert, in `data/uploads/`; Fallback: Farb-Monogramm)
- [ ] **Benutzerstatus**: online / abwesend (gelb) / nicht stoeren (rot, daempft Notifications) / offline + Statustext ("Bio")
- [ ] **Push-Benachrichtigungen** via Browser Notification API bei @-Mention & DMs (wenn Tab inaktiv)
- [ ] **Sound-Hinweis** bei neuen Nachrichten (abschaltbar)
- [ ] **Kanal-Thema/Beschreibung** + "Willkommen"-Nachricht bei User-Join
- [ ] **Spam-Bremse**: Rate-Limit pro Nutzer (max. 5 Msg/s) gegen versehentliches Spammen
- [ ] **Server-Einstellungen**: Icon (Emoji/Farbe), Name aendern, Invite-Codes revoke/regenerate

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

## 3b. Multi-User / Netzwerk-Betrieb (fix: mehrere Nutzer)
- Server lauscht auf `0.0.0.0:3000` -> andere im LAN/WLAN erreichen die App ueber `http://DEINE-IP:3000`
- `start.bat` zeigt nach dem Start automatisch alle moeglichen URLs an (localhost + LAN-IPs)
- Sessions laufen ueber Cookies -> funktioniert fuer alle Geraete im Netz (HTTP ok fuer LAN; fuer oeffentliche Exposure spaeter HTTPS/Reverse-Proxy)
- Ein Account pro Person: Registrierung offen fuer alle, die die URL kennen (optional Admin-Schalter "Registrierung schliessen")
- Realtime via WebSocket laeuft ohne Zusatzkonfig ueber denselben Port/dieselbe URL

## 3c. Benutzerprofile & Customization (Fokus-Bereich)
### Profil-Aufbau (Discord "User Profile Card", zwei Groessen)
```
+--------------------------------+   Popover: 340px breit
| #########  BANNER 600x240  ####|   Vollprofil:  Modal ~740px (2 Spalten:
|   [AV]  Anzeigename            |    links Karte wie rechts, rechts "Notizen")
|         @handle · sie/er       |
|--------------------------------|
| UEBER MICH                     |
|  "Bio-Text, mehrzeilig..."     |
| MEMBER SINCE 12.03.2026        |
| ROLLEN  [Admin][Moderator][...] |
| ABZEICHEN  🛡️ ⭐ 🎉            |
|--------------------------------|
| [💬 Nachricht senden]          |
+--------------------------------+
```

### Customization-Features im Profil-Editor ("Benutzereinstellungen -> Mein Profil")
- [ ] **Banner**: Upload (jpg/png/webp, empfohlen 1500x600, serverseitig zugeschnitten) ODER generierter Farbverlauf (Lineare Gradient-Presets + benutzerdefinierte 2 Farben mit Color-Picker) — beides waehlbar, Upload gewinnt
- [ ] **Avatar**: Upload (auf 256px skaliert, rund gerendert) ODER Farb-Monogramm (Hintergrundfarbe aus Picker + Initialen); Avatar-Glow optional (Ring in eigener Farbe)
- [ ] **Anzeigename** (displayName, frei waehlbar, unterscheidbar vom @username) und **Pronomen**-Feld (z.B. "er/ihm", "sie/ihren", "they/them")
- [ ] **Bio / "Ueber mich"** (Markdown-Unterstuetzung, max. 190 Zeichen wie Discord)
- [ ] **Akzent-/Namensfarbe** fuer Profil & Chat-Anzeige (Color-Picker mit Discord-Palette + freier Hex-Eingabe)
- [ ] **App-Thema**: Dark/Light-Toggle + Akzentfarbe ueberschreiben (blurple, groen, rot, pink, orange ...), gespeichert in `users.settings` -> gilt auf allen Geraeten (nicht nur localStorage)
- [ ] **Status**: online / abwesend / nicht stoeren / offline (automatisch nach Inaktivitaet, manuell ueberschreibbar) + Statustext
- [ ] **Badges** (automatisch vergeben, im Profil sichtbar): 🛡️ Server-Owner, ⭐ Ersten 10 Mitglieder eines Servers, 🎉 Registrierungsjubilaeum, ✍️ Vielschreiber (1000+ Nachrichten) — small, aber macht Spass
- [ ] Live-Vorschau im Editor: aenderungen zeigen sich sofort in einer Mini-Profilkarte rechts
- [ ] Profil-Modal per Klick auf den eigenen Avatar unten links (eigene Seite mit "Bearbeiten"-Button) und Klick auf fremde Avatare/Namen im Chat

### Design-Details Banner
- Banner-Fallback wenn nichts gesetzt: dezenter Blurple-Duotone-Gradient (`linear-gradient(135deg,#5865f2,#414ee5)`) — sieht immer gut aus
- Avatar ueberlappt Banner um ~28px, 6px Rand in Profil-Hintergrundfarbe (wie Discord)
- Hover auf Banner im Vollprofil: leichter Zoom (scale 1.03)

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

## 5. Design-Konzept (Discord-Look, dunkel)
### Farbpalette (CSS-Variablen)
| Token | Wert | Verwendung |
|---|---|---|
| `--bg-darkest` | `#1e1f22` | Guild-Rail (ganz links), Modals |
| `--bg-sidebar` | `#2b2d31` | Kanal-Liste, DM-Liste |
| `--bg-chat` | `#313338` | Chat-Hauptflaeche |
| `--bg-members` | `#2b2d31` | Mitgliederliste rechts |
| `--bg-input` | `#383a40` | Nachrichten-Eingabe, Hover |
| `--text-normal` | `#dbdee1` | Fliesstext |
| `--text-muted` | `#949ba4` | Zeitstempel, Sekundaeres |
| `--brand` | `#5865f2` | Buttons, Links, aktive Elemente ("blurple") |
| `--green` | `#23a55a` | Online-Punkt |
| `--yellow` | `#f0b232` | Abwesend |
| `--red` | `#f23f43` | Nicht stoeren / Loeschen / @everyone-Highlight |
| `--hover-bg` | `rgba(78,80,88,.3)` | Hover in Listen |

### Layout (Desktop, 5 Spalten von links nach rechts)
```
+----+------------+--------------------------+------------------+
|Rail| Kanale     | Header (#kanal + Thema)  | Mitglieder       |
|72px| Sidebar    | -------------------------| 240px            |
|Logo| 240px      | Nachrichtengruppe        | (einklappbar)    |
|Home| Kategorien | (Avatar, Name, Rolle,    |                  |
|+   | #Textkanae |  Inhalt, Zeitstempel)    | Rollen-Gruppen   |
|Gui-| ...        | bei gleichem Autor <10m: | mit Farben       |
|lds | Ungelesen: |  eingerueckt, ohne Kopf  |                  |
|    | weisser Pkt| -------------------------|                  |
|Avat| + Trenner  | "X tippt..."             |                  |
|ar  | datum      | [Textarea] [Emoji][Senden]|                 |
+----+------------+--------------------------+------------------+
```
- **Rail:** Runde Server-Icons (Hover -> abgerundetes Quadrat + Tooltip), Discord-/Home-Button, "+" zum Erstellen, Avatar unten links mit Status-Kreis
- **Sidebar:** Servername als Header (Dropdown: Invite, Einstellungen, Server verlassen), Kategorie-Collapsables, aktive Kanaele hervorgehoben, Ungelesen-Badge
- **Chat:** Nachrichtengruppierung wie oben, System-Nachrichten kursiv/grau, hover-Aktionen rechts oben pro Nachricht (Antworten, Reaktionen, Bearbeiten, Loeschen), Replies mit Einzug + Referenz-Zitat
- **Rechts:** Mitgliederliste klickbar -> **User-Profil-Popover** (340px, "User Profile Card" wie Discord): Banner oben (600x240), Avatar ueberlappt den Banner-Rand (72px, Statusring in Presence-Farbe), darunter Name (in Rollenfarbe), @handle, Pronomen, Trennlinie, "Ueber mich"-Box (Bio + Member-since), Rolle-Chips, Badges, Footer mit Aktionen ("Nachricht senden", "Profil ansehen") — Details in Kap. 3c
- **Modals:** zentriert, `#1e1f22`, Blur-Backdrop — fuer Erstellen/Einladen/Bestaetigungen
- **Responsive:** < 1000px blendet Mitgliederliste aus; < 768px wird Sidebar zum Overlay-Sheet (Handy-tauglich fuer die anderen Nutzer)
- **Typografie:** System-Font-Stack aehnlich Discord ("gg sans" nicht verfuegbar -> Inter/system-ui), 15px Chat-Text, 12px Zeitstempel/Labels, UPPERCASE-Section-Header mit Letter-Spacing
- **Micro-Interactions:** sanfte 0.1s-Transitions, Scroll-to-bottom-Button mit Ungelesenen-Zaehler, Subtle Animations beim Nachrichteneingang (kein Springy-Stuff)
- **Light-Mode:** optionaler Toggle (Theme via CSS-Variablen -> 2 Paletten), gespeichert im localStorage

## 6. UX-Flows (Kernpfade)
1. **Erste Schritte:** Landing -> Registrierung (Name, Passwort) -> landet direkt im "Home" mit 2 Klick-Anleitungen: "Server erstellen" oder "Per Code beitreten"
2. **Server erstellen:** Modal (Name + Emoji/Icon-Farbe) -> Owner bekommt ein Standard-Channel-Setup: `#allgemeines`, `#regen` + Willkommensnachricht; Invite-Code generierbar
3. **Beitreten:** "+ Server beitreten" -> Code einfügen -> Kanal-Liste erscheint, Welcome-Systemmsg im Chat, Member-Update live bei allen Online-Nutzern
4. **Schreiben:** Enter sendet, Shift+Enter neue Zeile; `/emoji-name:` Autocomplete; `@`-Autocomplete fuer Mitglieder; Upload per Drag&Drop ins Chatfenster
5. **Notifications:** Badge an Kanal (Sidebar) + Server (Rail); Browser-Push wenn Tab weg; roter Punkt am Home-Button
6. **Moderation:** Rechtsklick auf Mitglied (oder Profil-Popover) -> Kicken / Bannen / Rollen zuweisen (nur mit Permission)
7. **Suche:** Lupe im Header -> Suchleiste, Ergebnisse im Chat-Fenster mit Highlight + Jump-to-Message

## 7. Datenmodell (SQLite, final)
- `users(id, username UNIQUE, display_name, pronouns, email, pass_hash, salt, avatar_path, banner_path, banner_css, accent_color, bio, status, status_text, settings JSON, created_at)` *(banner_css = gespeicherter Farbverlauf wenn kein Upload; settings = theme/accent/dnd praefereenzen)*
- `sessions(token PK, user_id, created_at, expires_at)`
- `guilds(id, name, icon_emoji, icon_color, owner_id, invite_code, open_reg, created_at)`
- `members(guild_id+user_id PK, role_ids JSON, joined_at, banned 0/1)`
- `roles(id, guild_id, name, color, perms bitmask, position, hoist)`
- `channels(id, guild_id, category_id, name, topic, type text|voice?, position)` *(voice erst Phase 2+)*
- `messages(id, channel_id, sender_id, content, reply_to, edited_at, deleted 0/1, pinned, created_at)`
- `reactions(message_id+user_id+emoji PK)`
- `dm_channels(id, is_group, name?)` + `dm_participants(dm_id+user_id PK)`
- `reads(user_id+channel_id PK, last_read_msg_id, last_read_at)`
- `uploads(id, path, mime, size, uploader_id, created_at)`
- Indizes: messages(channel_id, id), members(user_id), sessions(expires_at)

## 8. WebSocket-Protokoll (bewusst schlank, JSON)
Client->Server: `msg:send`, `msg:edit`, `msg:delete`, `react:add/remove`, `typing:start`, `dm:send`, `read:set`, `presence:set`, `subscribe:{channel}`
Server->Client: `msg:new`, `msg:update`, `msg:remove`, `react:update`, `typing`, `presence`, `member:join/leave/ban`, `channel:new/update/delete`, `guild:update`, `notif:{...}`
- Auth: Session-Token beim WS-Handshake (Cookie reicht, same-origin)
- Heartbeat ping/pong alle 30s, Auto-Reconnect im Client (exponentiell, max 10s)

## 9. Meilensteine & Reihenfolge der Umsetzung
1. **M1 Geruest:** Repo-Struktur, package.json workspaces, Express statisch + `/api/health`, Vite-Build, `start.bat`/`launch.sh` lauffaehig
2. **M2 Auth+DB:** Schema-Migration, Registrierung/Login/Logout, Session-Middleware, geschuetztes Frontend (Login-Screen)
3. **M3 Kern-Chats:** Guilds/Kanaele CRUD, Nachrichten REST + WS, Chat-UI mit 5-Spalten-Layout, Persistenz sichtbar
4. **M4 Realtime-Feinschliff:** Typing, Presence, Ungelesen, Badges, member list, reactions/replies/mentions
5. **M5 DMs + Moderation + Suche + Notifications + Uploads**
6. **M6 Profil-Fokus (Kap. 3c):** Profilkarten (Popover + Vollprofil-Modal), Banner-/Avatar-Upload, Farbverlauf-Banner, Pronomen/Bio/Akzentfarbe, Theme-Persistenz, Badges, Profil-Editor mit Live-Vorschau
7. **M7 Polishing:** Responsive, Sound, Onboarding-Empty-States, Readme mit Screenshot
Jeder Meilenstein endet mit einem Testlauf ueber `./launch.sh` bzw. `start.bat`.

## 10. Umsetzungs-Checkliste
1. ✅ Plan bestätigen / anpassen
2. Grundgerüst (package.json, Ordner, launch.sh)
3. Backend: DB-Schema + Auth + REST
4. WebSocket: Nachrichten, Presence, Typing
5. Frontend: Layout + Komponenten
6. Extras & Feinschliff
