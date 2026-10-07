// Auth: scrypt-Passwörter + Session-Cookies (Node-Builtins, keine nativen Deps)
const crypto = require('crypto');
const { db } = require('./db');

const SESSION_DAYS = 30;

function hashPassword(pass, salt) {
  return crypto.scryptSync(pass, salt, 64).toString('hex');
}

function createUser({ username, display_name, password }) {
  username = String(username || '').trim().toLowerCase();
  display_name = String(display_name || '').trim() || username;
  if (!/^[a-z0-9_.]{2,32}$/.test(username)) throw new Error('Benutzername: 2-32 Zeichen, nur a-z 0-9 . _');
  if (display_name.length > 32) throw new Error('Anzeigename zu lang (max. 32)');
  if (!password || password.length < 6) throw new Error('Passwort: min. 6 Zeichen');
  const salt = crypto.randomBytes(16).toString('hex');
  const pass_hash = hashPassword(password, salt);
  try {
    const r = db.prepare('INSERT INTO users(username, display_name, pass_hash, salt, created_at) VALUES(?,?,?,?,?)')
      .run(username, display_name, pass_hash, salt, Date.now());
    return getUser(r.lastInsertRowid);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Benutzername schon vergeben');
    throw e;
  }
}

function verifyLogin(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || '').trim().toLowerCase());
  if (!u) return null;
  const h = hashPassword(password, u.salt);
  const ok = crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.pass_hash));
  return ok ? getUser(u.id) : null;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES(?,?,?,?)')
    .run(token, userId, now, now + SESSION_DAYS * 864e5);
  return token;
}

function getSessionUser(req) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const s = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token=?').get(m[1]);
  if (!s || s.expires_at < Date.now()) return null;
  return getUser(s.user_id);
}

function destroySession(req) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
  if (m) db.prepare('DELETE FROM sessions WHERE token=?').run(m[1]);
}

function getUser(id) {
  const u = db.prepare(`SELECT id,username,display_name,pronouns,avatar_path,banner_path,banner_css,
    accent_color,bio,status,status_text,settings,created_at FROM users WHERE id=?`).get(id);
  if (!u) return null;
  try { u.settings = JSON.parse(u.settings || '{}'); } catch { u.settings = {}; }
  return u;
}

function getUserBadges(userId) {
  const badges = [];
  const owned = db.prepare('SELECT COUNT(*) c FROM guilds WHERE owner_id=?').get(userId).c;
  if (owned > 0) badges.push('OWNER');
  const first10 = db.prepare(`SELECT COUNT(*) c FROM members m JOIN guilds g ON g.id=m.guild_id
    WHERE m.user_id=? AND m.joined_at <= (SELECT joined_at FROM members WHERE user_id=? AND guild_id=m.guild_id ORDER BY joined_at LIMIT 1)
    AND (SELECT COUNT(*) FROM members x WHERE x.guild_id=m.guild_id AND x.joined_at <= m.joined_at) <= 10`).get(userId, userId).c;
  if (first10 > 0) badges.push('EARLY');
  const msgs = db.prepare('SELECT COUNT(*) c FROM messages WHERE sender_id=?').get(userId).c;
  if (msgs >= 1000) badges.push('SCRIPTER');
  const ageDays = (Date.now() - (getUser(userId)?.created_at || Date.now())) / 864e5;
  if (ageDays >= 365) badges.push('ANNIV');
  if (msgs >= 100) badges.push('VETERAN');
  return badges;
}

module.exports = { createUser, verifyLogin, createSession, getSessionUser, destroySession, getUser, getUserBadges };
