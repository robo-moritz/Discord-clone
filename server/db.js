// SQLite-Datenbank (better-sqlite3) — Schema + Helpers
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'blurchat.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  pronouns TEXT DEFAULT '',
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  avatar_path TEXT DEFAULT '',
  banner_path TEXT DEFAULT '',
  banner_css TEXT DEFAULT '',
  accent_color TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  status TEXT DEFAULT 'online',          -- online|idle|dnd|invisible
  status_text TEXT DEFAULT '',
  settings TEXT DEFAULT '{}',            -- JSON: theme, accent, sound...
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS guilds(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon_emoji TEXT DEFAULT '',
  icon_color TEXT DEFAULT '#5865f2',
  owner_id INTEGER NOT NULL REFERENCES users(id),
  invite_code TEXT UNIQUE NOT NULL,
  registration_open INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS members(
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_ids TEXT DEFAULT '[]',
  banned INTEGER DEFAULT 0,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY(guild_id,user_id)
);
CREATE TABLE IF NOT EXISTS roles(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '',
  perms INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  hoist INTEGER DEFAULT 0,
  managed INTEGER DEFAULT 0             -- @everyone-Rolle
);
CREATE TABLE IF NOT EXISTS categories(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS channels(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  topic TEXT DEFAULT '',
  type TEXT DEFAULT 'text',
  position INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,           -- channels.id oder dm_channels.id
  channel_kind TEXT NOT NULL,            -- 'guild' | 'dm'
  sender_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  reply_to INTEGER,
  edited_at INTEGER,
  deleted INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  attachment TEXT DEFAULT '',            -- JSON {url,name,size,mime}
  system INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_channel ON messages(channel_kind, channel_id, id);
CREATE TABLE IF NOT EXISTS reactions(
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY(message_id,user_id,emoji)
);
CREATE TABLE IF NOT EXISTS dm_channels(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  is_group INTEGER DEFAULT 0,
  name TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dm_participants(
  dm_id INTEGER NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(dm_id,user_id)
);
CREATE TABLE IF NOT EXISTS reads(
  user_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  channel_kind TEXT NOT NULL,
  last_read_msg_id INTEGER DEFAULT 0,
  PRIMARY KEY(user_id,channel_kind,channel_id)
);
CREATE TABLE IF NOT EXISTS friendships(
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',        -- pending|accepted
  requested_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,friend_id)
);
CREATE TABLE IF NOT EXISTS uploads(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  uploader_id INTEGER,
  created_at INTEGER NOT NULL
);
`);

// @everyone-Rolle automatisch für neue Guilds
const P = { KICK: 1<<0, BAN: 1<<1, MANAGE_CHANNELS: 1<<2, MANAGE_GUILD: 1<<3, MANAGE_ROLES: 1<<4, ADMIN: 1<<5 };

function ensureEveryoneRole(guildId) {
  const has = db.prepare('SELECT id FROM roles WHERE guild_id=? AND managed=1').get(guildId);
  if (!has) db.prepare('INSERT INTO roles(guild_id,name,color,perms,position,managed) VALUES(?,?,?,?,?,1)')
    .run(guildId, '@everyone', '', 0, 0);
}

module.exports = { db, P, ensureEveryoneRole, DATA_DIR, UPLOADS_DIR };
