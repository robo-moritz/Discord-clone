// REST-API-Routen (Auth, Guilds, Channels, Messages, DMs, Profile, Uploads)
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, P, ensureEveryoneRole, UPLOADS_DIR } = require('./db');
const auth = require('./auth');
// ws.js requiring api.js -> zyklischer Import: Zugriff zur Laufzeit
let _ws;
function wsr() { if (!_ws) _ws = require('./ws'); return _ws; }
const broadcastToGuild = (...a) => wsr().broadcastToGuild(...a);
const sendToUser = (...a) => wsr().sendToUser(...a);

const router = express.Router();

function requireAuth(req, res, next) {
  const u = auth.getSessionUser(req);
  if (!u) return res.status(401).json({ error: 'Nicht angemeldet' });
  req.user = u;
  next();
}
function err(res) { return e => res.status(400).json({ error: e.message || 'Fehler' }); }
function setCookie(res, token) {
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; Max-Age=${30*86400}; SameSite=Lax`);
}

/* ---------------- Auth ---------------- */
router.post('/register', (req, res) => {
  try {
    const u = auth.createUser(req.body);
    setCookie(res, auth.createSession(u.id));
    res.json({ user: u });
  } catch (e) { err(res)(e); }
});
router.post('/login', (req, res) => {
  const u = auth.verifyLogin(req.body.username, req.body.password);
  if (!u) return res.status(401).json({ error: 'Falscher Benutzername oder Passwort' });
  db.prepare(`UPDATE users SET status='online' WHERE id=?`).run(u.id);
  setCookie(res, auth.createSession(u.id));
  sendToUser(u.id, { t: 'presence', userId: u.id, status: 'online' });
  res.json({ user: auth.getUser(u.id) });
});
router.post('/logout', (req, res) => { auth.destroySession(req); res.clearCookie?.('sid'); res.json({ ok: 1 }); });
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user, badges: auth.getUserBadges(req.user.id) }));

/* ---------------- Profile ---------------- */
router.put('/profile', requireAuth, (req, res) => {
  const { display_name, pronouns, bio, accent_color, status_text, banner_css, settings } = req.body;
  const u = req.user;
  db.prepare(`UPDATE users SET display_name=COALESCE(?,display_name), pronouns=COALESCE(?,pronouns),
     bio=COALESCE(?,bio), accent_color=COALESCE(?,accent_color), status_text=COALESCE(?,status_text),
     banner_css=COALESCE(?,banner_css), settings=COALESCE(?,settings) WHERE id=?`)
    .run(
      display_name ?? null, (pronouns ?? '').slice(0,32) || null, (bio ?? '').slice(0,190) || null,
      accent_color ?? null, (status_text ?? '').slice(0,60) || null, (banner_css ?? '').slice(0,200) || null,
      settings ? JSON.stringify(settings) : null, u.id);
  res.json({ user: auth.getUser(u.id) });
});
router.put('/status', requireAuth, (req, res) => {
  const s = ['online','idle','dnd','invisible'].includes(req.body.status) ? req.body.status : 'online';
  db.prepare('UPDATE users SET status=? WHERE id=?').run(s, req.user.id);
  sendToUser(req.user.id, { t: 'presence', userId: req.user.id, status: s });
  res.json({ ok: 1, status: s });
});
router.post('/password', requireAuth, (req, res) => {
  const { old_password, new_password } = req.body;
  if (!auth.verifyLogin(req.user.username, old_password)) return res.status(400).json({ error: 'Altes Passwort falsch' });
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Neues Passwort: min. 6 Zeichen' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE users SET salt=?, pass_hash=? WHERE id=?').run(salt, crypto.scryptSync(new_password, salt, 64).toString('hex'), req.user.id);
  res.json({ ok: 1 });
});
router.get('/users/:id/profile', requireAuth, (req, res) => {
  const u = auth.getUser(+req.params.id);
  if (!u) return res.status(404).json({ error: 'Unbekannter Nutzer' });
  const guilds = db.prepare(`SELECT g.id,g.name FROM members m JOIN guilds g ON g.id=m.guild_id
    WHERE m.user_id=? AND m.banned=0 LIMIT 15`).all(u.id);
  res.json({ user: u, badges: auth.getUserBadges(u.id), common_guilds: guilds });
});

/* ---------------- Uploads (avatar/banner/attachment, base64-JSON) ---------------- */
router.post('/upload', requireAuth, (req, res) => {
  const { data, name, mime, kind } = req.body; // data: dataURL
  if (!data || !/^data:image\/(png|jpe?g|gif|webp);base64,/.test(data)) return res.status(400).json({ error: 'Nur Bilder (png/jpg/gif/webp)' });
  const b64 = data.split(',', 2)[1];
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Datei zu groß (max. 5 MB)' });
  const ext = { 'image/png':'.png', 'image/jpeg':'.jpg', 'image/jpg':'.jpg', 'image/gif':'.gif', 'image/webp':'.webp' }[mime] || '.png';
  const fname = `${kind||'file'}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, fname), buf);
  db.prepare('INSERT INTO uploads(path,mime,size,uploader_id,created_at) VALUES(?,?,?,?,?)').run(fname, mime, buf.length, req.user.id, Date.now());
  res.json({ url: `/uploads/${fname}`, name: name || fname, size: buf.length, mime });
});
router.put('/avatar', requireAuth, (req, res) => {
  const url = String(req.body.url || '');
  db.prepare('UPDATE users SET avatar_path=? WHERE id=?').run(url.startsWith('/uploads/') ? url : '', req.user.id);
  res.json({ user: auth.getUser(req.user.id) });
});
router.put('/banner', requireAuth, (req, res) => {
  const url = String(req.body.url || '');
  db.prepare('UPDATE users SET banner_path=? WHERE id=?').run(url.startsWith('/uploads/') ? url : '', req.user.id);
  res.json({ user: auth.getUser(req.user.id) });
});

/* ---------------- Guilds ---------------- */
function memberPerms(guildId, userId) {
  const g = db.prepare('SELECT owner_id FROM guilds WHERE id=?').get(guildId);
  if (!g) return 0;
  if (g.owner_id === userId) return P.ADMIN | P.KICK | P.BAN | P.MANAGE_CHANNELS | P.MANAGE_GUILD | P.MANAGE_ROLES;
  const m = db.prepare('SELECT role_ids FROM members WHERE guild_id=? AND user_id=?').get(guildId, userId);
  if (!m) return 0;
  let perms = 0;
  const everyone = db.prepare('SELECT perms FROM roles WHERE guild_id=? AND managed=1').get(guildId);
  if (everyone) perms |= everyone.perms;
  for (const rid of JSON.parse(m.role_ids || '[]')) {
    const r = db.prepare('SELECT perms FROM roles WHERE id=? AND guild_id=?').get(rid, guildId);
    if (r) perms |= r.perms;
  }
  if (perms & P.ADMIN) perms |= P.KICK | P.BAN | P.MANAGE_CHANNELS | P.MANAGE_GUILD | P.MANAGE_ROLES;
  return perms;
}
function inGuild(guildId, userId) {
  const m = db.prepare('SELECT banned FROM members WHERE guild_id=? AND user_id=?').get(guildId, userId);
  return m && !m.banned;
}
const genCode = () => crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8).toUpperCase();

router.get('/guilds', requireAuth, (req, res) => {
  const mine = db.prepare(`SELECT g.* FROM members m JOIN guilds g ON g.id=m.guild_id WHERE m.user_id=? AND m.banned=0`).all(req.user.id);
  res.json({ guilds: mine.map(g => ({ ...g, perms: memberPerms(g.id, req.user.id), unread: hasUnreadGuild(g.id, req.user.id) })) });
});
function hasUnreadGuild(guildId, userId) {
  const chans = db.prepare('SELECT id FROM channels WHERE guild_id=?').all(guildId);
  for (const c of chans) {
    const last = db.prepare('SELECT MAX(id) m FROM messages WHERE channel_kind=\'guild\' AND channel_id=? AND deleted=0').get(c.id).m || 0;
    const read = db.prepare('SELECT last_read_msg_id r FROM reads WHERE user_id=? AND channel_kind=\'guild\' AND channel_id=?').get(userId, c.id)?.r || 0;
    if (last > read) {
      const own = db.prepare('SELECT sender_id FROM messages WHERE id=?').get(last);
      if (own && own.sender_id !== userId) return true;
    }
  }
  return false;
}
router.post('/guilds', requireAuth, (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 60);
    if (!name) throw new Error('Servername fehlt');
    const tr = db.transaction(() => {
      const gid = db.prepare('INSERT INTO guilds(name,icon_emoji,icon_color,owner_id,invite_code,created_at) VALUES(?,?,?,?,?,?)')
        .run(name, req.body.icon_emoji || name[0].toUpperCase(), req.body.icon_color || '#5865f2', req.user.id, genCode(), Date.now()).lastInsertRowid;
      ensureEveryoneRole(gid);
      db.prepare('INSERT INTO members(guild_id,user_id,joined_at) VALUES(?,?,?)').run(gid, req.user.id, Date.now());
      const adminRoleId = db.prepare('INSERT INTO roles(guild_id,name,color,perms,position) VALUES(?,?,?,?,?)')
        .run(gid, 'Admin', '#f23f43', P.ADMIN, 10).lastInsertRowid;
      db.prepare('UPDATE members SET role_ids=? WHERE guild_id=? AND user_id=?').run(JSON.stringify([adminRoleId]), gid, req.user.id);
      const modRoleId = db.prepare('INSERT INTO roles(guild_id,name,color,perms,position,hoist) VALUES(?,?,?,?,?,1)')
        .run(gid, 'Moderator', '#23a55a', P.KICK | P.BAN, 5).lastInsertRowid;
      const cat = db.prepare('INSERT INTO categories(guild_id,name,position) VALUES(?,?,?)').run(gid, 'Textkanäle', 0).lastInsertRowid;
      const cid = db.prepare('INSERT INTO channels(guild_id,category_id,name,topic,position) VALUES(?,?,?,?,?)').run(gid, cat, 'allgemeines', 'Willkommen auf diesem Server! 🎉', 0).lastInsertRowid;
      db.prepare('INSERT INTO channels(guild_id,category_id,name,position) VALUES(?,?,?,?)').run(gid, cat, 'regen', 1);
      db.prepare('INSERT INTO messages(channel_id,channel_kind,sender_id,content,system,created_at) VALUES(?,?,?,?,?,?)')
        .run(cid, 'guild', req.user.id, `✨ **${req.user.display_name}** hat diesen Server erstellt.`, 1, Date.now());
      return gid;
    });
    const gid = tr();
    res.json({ guild: db.prepare('SELECT * FROM guilds WHERE id=?').get(gid) });
  } catch (e) { err(res)(e); }
});
router.post('/guilds/join', requireAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const g = db.prepare('SELECT * FROM guilds WHERE invite_code=?').get(code);
  if (!g) return res.status(404).json({ error: 'Ungültiger Invite-Code' });
  const banned = db.prepare('SELECT banned FROM members WHERE guild_id=? AND user_id=?').get(g.id, req.user.id);
  if (banned && banned.banned) return res.status(403).json({ error: 'Du wurdest von diesem Server gebannt' });
  if (!banned) {
    db.prepare('INSERT INTO members(guild_id,user_id,joined_at) VALUES(?,?,?)').run(g.id, req.user.id, Date.now());
    const first = db.prepare('SELECT id FROM channels WHERE guild_id=? ORDER BY position LIMIT 1').get(g.id);
    if (first) db.prepare('INSERT INTO messages(channel_id,channel_kind,sender_id,content,system,created_at) VALUES(?,?,?,?,?,?)')
      .run(first.id, 'guild', req.user.id, `👋 **${req.user.display_name}** ist dem Server beigetreten.`, 1, Date.now());
    broadcastToGuild(g.id, { t: 'member:join', guildId: g.id, user: req.user });
  }
  res.json({ guild: g });
});
router.get('/guilds/:id', requireAuth, (req, res) => {
  const gid = +req.params.id;
  if (!inGuild(gid, req.user.id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const g = db.prepare('SELECT * FROM guilds WHERE id=?').get(gid);
  if (!g) return res.status(404).json({ error: 'Server nicht gefunden' });
  const cats = db.prepare('SELECT * FROM categories WHERE guild_id=? ORDER BY position').all(gid);
  const chans = db.prepare('SELECT * FROM channels WHERE guild_id=? ORDER BY category_id, position').all(gid);
  const roles = db.prepare('SELECT * FROM roles WHERE guild_id=? ORDER BY position DESC').all(gid);
  const members = db.prepare(`SELECT m.user_id, m.role_ids, m.joined_at, u.username,u.display_name,u.avatar_path,u.status,u.status_text,u.accent_color,u.pronouns
    FROM members m JOIN users u ON u.id=m.user_id WHERE m.guild_id=? AND m.banned=0`).all(gid)
    .map(m => ({ ...m, role_ids: JSON.parse(m.role_ids || '[]'), perms: memberPerms(gid, m.user_id) }));
  const reads = db.prepare('SELECT channel_id, channel_kind, last_read_msg_id FROM reads WHERE user_id=?').all(req.user.id);
  res.json({ guild: { ...g, perms: memberPerms(gid, req.user.id) }, categories: cats, channels: chans, roles, members, reads });
});
router.put('/guilds/:id', requireAuth, (req, res) => {
  const gid = +req.params.id;
  if (!(memberPerms(gid, req.user.id) & P.MANAGE_GUILD)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const { name, icon_emoji, icon_color, registration_open } = req.body;
  db.prepare(`UPDATE guilds SET name=COALESCE(?,name), icon_emoji=COALESCE(?,icon_emoji), icon_color=COALESCE(?,icon_color),
    registration_open=COALESCE(?,registration_open) WHERE id=?`)
    .run(name ?? null, icon_emoji ?? null, icon_color ?? null, registration_open == null ? null : (registration_open ? 1 : 0), gid);
  broadcastToGuild(gid, { t: 'guild:update', guild: db.prepare('SELECT * FROM guilds WHERE id=?').get(gid) });
  res.json({ ok: 1 });
});
router.post('/guilds/:id/invite/regen', requireAuth, (req, res) => {
  const gid = +req.params.id;
  if (!(memberPerms(gid, req.user.id) & P.MANAGE_GUILD)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const code = genCode();
  db.prepare('UPDATE guilds SET invite_code=? WHERE id=?').run(code, gid);
  res.json({ invite_code: code });
});
router.delete('/guilds/:id', requireAuth, (req, res) => {
  const gid = +req.params.id;
  const g = db.prepare('SELECT owner_id FROM guilds WHERE id=?').get(gid);
  if (!g || g.owner_id !== req.user.id) return res.status(403).json({ error: 'Nur der Owner kann löschen' });
  db.prepare('DELETE FROM guilds WHERE id=?').run(gid);
  broadcastToGuild(gid, { t: 'guild:delete', guildId: gid });
  res.json({ ok: 1 });
});
router.post('/guilds/:id/leave', requireAuth, (req, res) => {
  const gid = +req.params.id;
  const g = db.prepare('SELECT owner_id FROM guilds WHERE id=?').get(gid);
  if (!g) return res.status(404).json({ error: '?' });
  if (g.owner_id === req.user.id) return res.status(400).json({ error: 'Owner können nicht verlassen — lösche den Server stattdessen' });
  db.prepare('DELETE FROM members WHERE guild_id=? AND user_id=?').run(gid, req.user.id);
  broadcastToGuild(gid, { t: 'member:leave', guildId: gid, userId: req.user.id });
  res.json({ ok: 1 });
});

/* ---------------- Members / Roles / Moderation ---------------- */
router.put('/guilds/:id/members/:uid/roles', requireAuth, (req, res) => {
  const gid = +req.params.id, uid = +req.params.uid;
  if (!(memberPerms(gid, req.user.id) & P.MANAGE_ROLES)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const ids = JSON.stringify((req.body.role_ids || []).filter(r => db.prepare('SELECT id FROM roles WHERE id=? AND guild_id=?').get(r, gid)));
  db.prepare('UPDATE members SET role_ids=? WHERE guild_id=? AND user_id=?').run(ids, gid, uid);
  broadcastToGuild(gid, { t: 'member:update', guildId: gid, userId: uid });
  res.json({ ok: 1 });
});
router.post('/guilds/:id/kick/:uid', requireAuth, (req, res) => {
  const gid = +req.params.id, uid = +req.params.uid;
  if (!(memberPerms(gid, req.user.id) & P.KICK)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const g = db.prepare('SELECT owner_id FROM guilds WHERE id=?').get(gid);
  if (g.owner_id === uid || uid === req.user.id) return res.status(400).json({ error: 'Diese Person kannst du nicht kicken' });
  db.prepare('DELETE FROM members WHERE guild_id=? AND user_id=?').run(gid, uid);
  broadcastToGuild(gid, { t: 'member:leave', guildId: gid, userId: uid, kicked: true });
  res.json({ ok: 1 });
});
router.post('/guilds/:id/ban/:uid', requireAuth, (req, res) => {
  const gid = +req.params.id, uid = +req.params.uid;
  if (!(memberPerms(gid, req.user.id) & P.BAN)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const g = db.prepare('SELECT owner_id FROM guilds WHERE id=?').get(gid);
  if (g.owner_id === uid || uid === req.user.id) return res.status(400).json({ error: 'Das geht nicht' });
  db.prepare('INSERT INTO members(guild_id,user_id,banned,joined_at) VALUES(?,?,1,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET banned=1')
    .run(gid, uid, Date.now());
  broadcastToGuild(gid, { t: 'member:leave', guildId: gid, userId: uid, banned: true });
  res.json({ ok: 1 });
});
router.get('/guilds/:id/bans', requireAuth, (req, res) => {
  const gid = +req.params.id;
  if (!(memberPerms(gid, req.user.id) & P.BAN)) return res.status(403).json({ error: 'Keine Berechtigung' });
  res.json({ bans: db.prepare(`SELECT u.id,u.username,u.display_name FROM members m JOIN users u ON u.id=m.user_id WHERE m.guild_id=? AND m.banned=1`).all(gid) });
});
router.delete('/guilds/:id/bans/:uid', requireAuth, (req, res) => {
  const gid = +req.params.id;
  if (!(memberPerms(gid, req.user.id) & P.BAN)) return res.status(403).json({ error: 'Keine Berechtigung' });
  db.prepare('DELETE FROM members WHERE guild_id=? AND user_id=? AND banned=1').run(gid, +req.params.uid);
  res.json({ ok: 1 });
});
router.post('/guilds/:id/roles', requireAuth, (req, res) => {
  const gid = +req.params.id;
  if (!(memberPerms(gid, req.user.id) & P.MANAGE_ROLES)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const { name, color, perms, hoist } = req.body;
  if (!name) return res.status(400).json({ error: 'Rollenname fehlt' });
  const pos = (db.prepare('SELECT MAX(position) p FROM roles WHERE guild_id=?').get(gid).p || 0) + 1;
  const id = db.prepare('INSERT INTO roles(guild_id,name,color,perms,position,hoist) VALUES(?,?,?,?,?,?)')
    .run(gid, String(name).slice(0, 32), color || '', (+perms) || 0, pos, hoist ? 1 : 0).lastInsertRowid;
  broadcastToGuild(gid, { t: 'role:new', guildId: gid, role: db.prepare('SELECT * FROM roles WHERE id=?').get(id) });
  res.json({ role: db.prepare('SELECT * FROM roles WHERE id=?').get(id) });
});
router.put('/roles/:id', requireAuth, (req, res) => {
  const r = db.prepare('SELECT * FROM roles WHERE id=?').get(+req.params.id);
  if (!r) return res.status(404).json({ error: '?' });
  if (!(memberPerms(r.guild_id, req.user.id) & P.MANAGE_ROLES)) return res.status(403).json({ error: 'Keine Berechtigung' });
  db.prepare('UPDATE roles SET name=?, color=?, perms=?, hoist=? WHERE id=?')
    .run(String(req.body.name ?? r.name).slice(0,32), req.body.color ?? r.color, req.body.perms ?? r.perms, req.body.hoist ?? r.hoist, r.id);
  broadcastToGuild(r.guild_id, { t: 'role:update', guildId: r.guild_id, role: db.prepare('SELECT * FROM roles WHERE id=?').get(r.id) });
  res.json({ ok: 1 });
});
router.delete('/roles/:id', requireAuth, (req, res) => {
  const r = db.prepare('SELECT * FROM roles WHERE id=?').get(+req.params.id);
  if (!r || r.managed) return res.status(400).json({ error: 'Kann nicht gelöscht werden' });
  if (!(memberPerms(r.guild_id, req.user.id) & P.MANAGE_ROLES)) return res.status(403).json({ error: 'Keine Berechtigung' });
  db.prepare('DELETE FROM roles WHERE id=?').run(r.id);
  broadcastToGuild(r.guild_id, { t: 'role:delete', guildId: r.guild_id, roleId: r.id });
  res.json({ ok: 1 });
});

/* ---------------- Channels ---------------- */
router.post('/guilds/:id/channels', requireAuth, (req, res) => {
  const gid = +req.params.id;
  if (!(memberPerms(gid, req.user.id) & P.MANAGE_CHANNELS)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const name = String(req.body.name || '').toLowerCase().replace(/[^a-z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
  if (!name) return res.status(400).json({ error: 'Kanalname fehlt' });
  const pos = (db.prepare('SELECT MAX(position) p FROM channels WHERE guild_id=?').get(gid).p || 0) + 1;
  const id = db.prepare('INSERT INTO channels(guild_id,category_id,name,topic,position) VALUES(?,?,?,?,?)')
    .run(gid, req.body.category_id || null, name, req.body.topic || '', pos).lastInsertRowid;
  const ch = db.prepare('SELECT * FROM channels WHERE id=?').get(id);
  broadcastToGuild(gid, { t: 'channel:new', guildId: gid, channel: ch });
  res.json({ channel: ch });
});
router.put('/channels/:id', requireAuth, (req, res) => {
  const ch = db.prepare('SELECT * FROM channels WHERE id=?').get(+req.params.id);
  if (!ch) return res.status(404).json({ error: '?' });
  if (!(memberPerms(ch.guild_id, req.user.id) & P.MANAGE_CHANNELS)) return res.status(403).json({ error: 'Keine Berechtigung' });
  db.prepare('UPDATE channels SET name=COALESCE(?,name), topic=COALESCE(?,topic), category_id=COALESCE(?,category_id) WHERE id=?')
    .run(req.body.name ? String(req.body.name).toLowerCase().replace(/\s+/g,'-').slice(0,40) : null, req.body.topic ?? null, req.body.category_id ?? null, ch.id);
  const upd = db.prepare('SELECT * FROM channels WHERE id=?').get(ch.id);
  broadcastToGuild(ch.guild_id, { t: 'channel:update', guildId: ch.guild_id, channel: upd });
  res.json({ channel: upd });
});
router.delete('/channels/:id', requireAuth, (req, res) => {
  const ch = db.prepare('SELECT * FROM channels WHERE id=?').get(+req.params.id);
  if (!ch) return res.status(404).json({ error: '?' });
  if (!(memberPerms(ch.guild_id, req.user.id) & P.MANAGE_CHANNELS)) return res.status(403).json({ error: 'Keine Berechtigung' });
  db.prepare('DELETE FROM messages WHERE channel_kind=\'guild\' AND channel_id=?').run(ch.id);
  db.prepare('DELETE FROM channels WHERE id=?').run(ch.id);
  broadcastToGuild(ch.guild_id, { t: 'channel:delete', guildId: ch.guild_id, channelId: ch.id });
  res.json({ ok: 1 });
});
router.post('/guilds/:id/categories', requireAuth, (req, res) => {
  const gid = +req.params.id;
  if (!(memberPerms(gid, req.user.id) & P.MANAGE_CHANNELS)) return res.status(403).json({ error: 'Keine Berechtigung' });
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: 'Name fehlt' });
  const pos = (db.prepare('SELECT MAX(position) p FROM categories WHERE guild_id=?').get(gid).p || 0) + 1;
  const id = db.prepare('INSERT INTO categories(guild_id,name,position) VALUES(?,?,?)').run(gid, name, pos).lastInsertRowid;
  broadcastToGuild(gid, { t: 'category:new', guildId: gid, category: db.prepare('SELECT * FROM categories WHERE id=?').get(id) });
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id=?').get(id) });
});

/* ---------------- Messages (REST-Pfad für Laden/Suche; senden via WS) ---------------- */
router.get('/channels/:id/messages', requireAuth, (req, res) => {
  const cid = +req.params.id;
  const ch = db.prepare('SELECT * FROM channels WHERE id=?').get(cid);
  if (!ch || !inGuild(ch.guild_id, req.user.id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const before = +req.query.before || 1e18;
  const rows = db.prepare('SELECT * FROM messages WHERE channel_kind=\'guild\' AND channel_id=? AND id<? ORDER BY id DESC LIMIT 50').all(cid, before);
  res.json({ messages: hydrateMessages(rows.reverse(), req.user.id) });
});
router.get('/dms/:id/messages', requireAuth, (req, res) => {
  const dmId = +req.params.id;
  if (!isDmMember(dmId, req.user.id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const before = +req.query.before || 1e18;
  const rows = db.prepare('SELECT * FROM messages WHERE channel_kind=\'dm\' AND channel_id=? AND id<? ORDER BY id DESC LIMIT 50').all(dmId, before);
  res.json({ messages: hydrateMessages(rows.reverse(), req.user.id) });
});
function isDmMember(dmId, userId) {
  return !!db.prepare('SELECT 1 FROM dm_participants WHERE dm_id=? AND user_id=?').get(dmId, userId);
}
function hydrateMessages(rows, viewerId) {
  const out = [];
  const st = db.prepare('SELECT id,username,display_name,avatar_path,accent_color FROM users WHERE id=?');
  for (const m of rows) {
    const sender = st.get(m.sender_id) || { id: 0, username: 'unknown', display_name: 'Unbekannt' };
    const reactions = {};
    for (const g of db.prepare('SELECT emoji, COUNT(*) c, GROUP_CONCAT(user_id) uids FROM reactions WHERE message_id=? GROUP BY emoji').all(m.id)) {
      const uids = String(g.uids || '').split(',').map(Number);
      reactions[g.emoji] = { count: g.c, me: uids.includes(viewerId), uids };
    }
    let reply = null;
    if (m.reply_to) {
      const r = db.prepare('SELECT id, content, sender_id FROM messages WHERE id=?').get(m.reply_to);
      if (r) reply = { id: r.id, author: st.get(r.sender_id), content: r.content.slice(0, 120) };
    }
    out.push({ ...m, sender, reactions, reply, attachment: m.attachment ? JSON.parse(m.attachment) : null });
  }
  return out;
}

router.get('/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  const gid = +req.query.guild_id;
  if (q.length < 2 || !gid || !inGuild(gid, req.user.id)) return res.json({ results: [] });
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const rows = db.prepare(`SELECT m.* FROM messages m JOIN channels c ON c.id=m.channel_id
    WHERE m.channel_kind='guild' AND c.guild_id=? AND m.deleted=0 AND m.content LIKE ? ORDER BY m.id DESC LIMIT 30`).all(gid, like);
  res.json({ results: hydrateMessages(rows, req.user.id) });
});

/* ---------------- DMs ---------------- */
router.get('/dms', requireAuth, (req, res) => {
  const dms = db.prepare(`SELECT d.* FROM dm_channels d JOIN dm_participants p ON p.dm_id=d.id WHERE p.user_id=?`).all(req.user.id);
  const out = dms.map(d => {
    const parts = db.prepare(`SELECT u.id,u.username,u.display_name,u.avatar_path,u.status,u.accent_color FROM dm_participants p JOIN users u ON u.id=p.user_id WHERE p.dm_id=?`).all(d.id);
    const last = db.prepare('SELECT * FROM messages WHERE channel_kind=\'dm\' AND channel_id=? ORDER BY id DESC LIMIT 1').get(d.id);
    return { ...d, participants: parts, last_message: last ? hydrateMessages([last], req.user.id)[0] : null };
  });
  out.sort((a, b) => (b.last_message?.id || 0) - (a.last_message?.id || 0));
  res.json({ dms: out });
});
router.post('/dms/open', requireAuth, (req, res) => {
  const otherId = +req.body.user_id;
  if (!otherId || otherId === req.user.id) return res.status(400).json({ error: 'Ungültiger Nutzer' });
  const existing = db.prepare(`SELECT d.* FROM dm_channels d JOIN dm_participants a ON a.dm_id=d.id AND a.user_id=?
    JOIN dm_participants b ON b.dm_id=d.id AND b.user_id=? WHERE d.is_group=0`).get(req.user.id, otherId);
  if (existing) return res.json({ dm: existing });
  const dmId = db.prepare('INSERT INTO dm_channels(is_group,created_at) VALUES(0,?)').run(Date.now()).lastInsertRowid;
  db.prepare('INSERT INTO dm_participants(dm_id,user_id) VALUES(?,?)').run(dmId, req.user.id);
  db.prepare('INSERT INTO dm_participants(dm_id,user_id) VALUES(?,?)').run(dmId, otherId);
  const dm = db.prepare('SELECT * FROM dm_channels WHERE id=?').get(dmId);
  res.json({ dm });
});
router.post('/dms/group', requireAuth, (req, res) => {
  const ids = [...new Set([req.user.id, ...(req.body.user_ids || []).map(Number)])].filter(Boolean);
  if (ids.length < 2) return res.status(400).json({ error: 'Mind. 2 Teilnehmer' });
  const dmId = db.prepare('INSERT INTO dm_channels(is_group,name,created_at) VALUES(1,?,?)').run(String(req.body.name || 'Gruppe').slice(0, 40), Date.now()).lastInsertRowid;
  for (const id of ids) db.prepare('INSERT OR IGNORE INTO dm_participants(dm_id,user_id) VALUES(?,?)').run(dmId, id);
  res.json({ dm: db.prepare('SELECT * FROM dm_channels WHERE id=?').get(dmId) });
});
router.get('/dms/:id', requireAuth, (req, res) => {
  const dmId = +req.params.id;
  if (!isDmMember(dmId, req.user.id)) return res.status(403).json({ error: 'Kein Zugriff' });
  const parts = db.prepare(`SELECT u.id,u.username,u.display_name,u.avatar_path,u.status,u.accent_color FROM dm_participants p JOIN users u ON u.id=p.user_id WHERE p.dm_id=?`).all(dmId);
  res.json({ dm: db.prepare('SELECT * FROM dm_channels WHERE id=?').get(dmId), participants: parts });
});

/* ---------------- Freundschaften ---------------- */
router.get('/friends', requireAuth, (req, res) => {
  const f = db.prepare(`SELECT u.id,u.username,u.display_name,u.avatar_path,u.status,u.accent_color,u.status_text
    FROM friendships fs JOIN users u ON u.id = CASE WHEN fs.user_id=? THEN fs.friend_id ELSE fs.user_id END
    WHERE (fs.user_id=? OR fs.friend_id=?) AND fs.status='accepted'`).all(req.user.id, req.user.id, req.user.id);
  const inc = db.prepare(`SELECT u.id,u.username,u.display_name,u.avatar_path FROM friendships fs JOIN users u ON u.id=fs.requested_by
    WHERE fs.friend_id=? AND fs.status='pending'`).all(req.user.id);
  const out = db.prepare(`SELECT u.id,u.username,u.display_name,u.avatar_path FROM friendships fs JOIN users u ON u.id=fs.friend_id
    WHERE fs.user_id=? AND fs.status='pending' AND fs.requested_by=?`).all(req.user.id, req.user.id);
  res.json({ friends: f, incoming: inc, outgoing: out });
});
function friendPair(a, b) { return [Math.min(a,b), Math.max(a,b)]; }
router.post('/friends/request/:uid', requireAuth, (req, res) => {
  const [x, y] = friendPair(req.user.id, +req.params.uid);
  if (x === y) return res.status(400).json({ error: '?' });
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(y)) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  const ex = db.prepare('SELECT * FROM friendships WHERE user_id=? AND friend_id=?').get(x, y);
  if (ex) {
    if (ex.status === 'accepted') return res.status(400).json({ error: 'Schon befreundet' });
    if (ex.requested_by === y) { // Gegenanfrage annehmen
      db.prepare('UPDATE friendships SET status=\'accepted\' WHERE user_id=? AND friend_id=?').run(x, y);
      sendToUser(y, { t: 'friend:accepted', by: req.user });
      return res.json({ ok: 1, accepted: true });
    }
    return res.status(400).json({ error: 'Anfrage bereits gesendet' });
  }
  db.prepare('INSERT INTO friendships(user_id,friend_id,status,requested_by,created_at) VALUES(?,?,?,?,?)').run(x, y, 'pending', req.user.id, Date.now());
  sendToUser(y, { t: 'friend:request', from: req.user });
  res.json({ ok: 1 });
});
router.post('/friends/accept/:uid', requireAuth, (req, res) => {
  const [x, y] = friendPair(req.user.id, +req.params.uid);
  const ex = db.prepare('SELECT * FROM friendships WHERE user_id=? AND friend_id=?').get(x, y);
  if (!ex || ex.status !== 'pending' || ex.requested_by === req.user.id) return res.status(400).json({ error: 'Keine offene Anfrage' });
  db.prepare('UPDATE friendships SET status=\'accepted\' WHERE user_id=? AND friend_id=?').run(x, y);
  sendToUser(y, { t: 'friend:accepted', by: req.user });
  res.json({ ok: 1 });
});
router.delete('/friends/:uid', requireAuth, (req, res) => {
  const [x, y] = friendPair(req.user.id, +req.params.uid);
  db.prepare('DELETE FROM friendships WHERE user_id=? AND friend_id=?').run(x, y);
  res.json({ ok: 1 });
});
router.get('/users/find', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ users: [] });
  const users = db.prepare(`SELECT id,username,display_name,avatar_path,status FROM users
    WHERE (username LIKE ? OR display_name LIKE ?) AND id!=? LIMIT 10`).all(`${q}%`, `%${q}%`, req.user.id);
  res.json({ users });
});

module.exports = { router, memberPerms, inGuild, hydrateMessages, isDmMember };
