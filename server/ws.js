// WebSocket-Realtime-Layer: Nachrichten, Reaktionen, Typing, Presence, Read-Receipts
const { WebSocketServer } = require('ws');
const { db, P } = require('./db');
const auth = require('./auth');
// api.js requiring ws.js -> zyklischer Import: Zugriffe erst zur Laufzeit
let _api;
function api() { if (!_api) _api = require('./api'); return _api; }
const memberPerms = (...a) => api().memberPerms(...a);
const inGuild = (...a) => api().inGuild(...a);
const hydrateMessages = (...a) => api().hydrateMessages(...a);
const isDmMember = (...a) => api().isDmMember(...a);

let wss;
const clients = new Map(); // ws -> { user, rooms:Set<string> }

const guildRoom = gid => `g:${gid}`;
const channelRoomId = (kind, id) => `${kind}:${id}`;
const userRoom = uid => `u:${uid}`;

function addToRoom(ws, room) { clients.get(ws).rooms.add(room); }
function broadcastRoom(room, payload, exceptUserId = null) {
  const data = JSON.stringify(payload);
  for (const [ws, meta] of clients) {
    if (meta.rooms.has(room) && (!exceptUserId || meta.user.id !== exceptUserId)) {
      if (ws.readyState === 1) ws.send(data);
    }
  }
}
function broadcastToGuild(gid, payload) { broadcastRoom(guildRoom(gid), payload); }
function sendToUser(uid, payload) { broadcastRoom(userRoom(uid), payload); }

// Wer kann einen Channel sehen? Guild-Mitglieder oder DM-Teilnehmer
function canAccessChannel(userId, kind, channelId) {
  if (kind === 'dm') return isDmMember(channelId, userId);
  const ch = db.prepare('SELECT guild_id FROM channels WHERE id=?').get(channelId);
  return !!ch && inGuild(ch.guild_id, userId);
}

// Rate-Limit: max. 5 Nachrichten/Sekunde pro Nutzer
const rateBuckets = new Map();
function rateLimited(userId) {
  const now = Date.now();
  const b = rateBuckets.get(userId) || [];
  const recent = b.filter(t => now - t < 1000);
  if (recent.length >= 5) return true;
  recent.push(now);
  rateBuckets.set(userId, recent);
  return false;
}

function attach(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const user = auth.getSessionUser(req);
    if (!user) { ws.close(4001, 'no-auth'); return; }
    clients.set(ws, { user, rooms: new Set([userRoom(user.id)]) });
    db.prepare(`UPDATE users SET status='online' WHERE id=?`).run(user.id);
    broadcastRoom('*', { t: 'presence', userId: user.id, status: 'online' });
    sendToUser(user.id, { t: 'hello', user });

    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      try { handle(ws, m); } catch (e) { ws.send(JSON.stringify({ t: 'error', error: e.message, ref: m.t })); }
    });
    ws.on('close', () => {
      const meta = clients.get(ws);
      clients.delete(ws);
      if (!meta) return;
      const stillOnline = [...clients.values()].some(c => c.user.id === meta.user.id);
      if (!stillOnline) {
        db.prepare(`UPDATE users SET status='offline' WHERE id=?`).run(meta.user.id);
        broadcastAll({ t: 'presence', userId: meta.user.id, status: 'offline' });
      }
    });
  });

  // Heartbeat
  setInterval(() => {
    for (const [ws] of clients) if (ws.readyState === 1) ws.ping();
  }, 30000).unref();
}

function broadcastAll(payload) {
  const data = JSON.stringify(payload);
  for (const [ws] of clients) if (ws.readyState === 1) ws.send(data);
}

function handle(ws, m) {
  const meta = clients.get(ws);
  const me = meta.user;

  switch (m.t) {
    case 'subscribe': { // {t:'subscribe', rooms:['g:1','guild:5','dm:2']}
      const rooms = Array.isArray(m.rooms) ? m.rooms : [];
      for (const r of rooms) {
        if (r.startsWith('g:') && inGuild(+r.slice(2), me.id)) addToRoom(ws, r);
        else if (r.startsWith('guild:') && inGuild(+r.slice(6), me.id)) addToRoom(ws, channelRoomId('guild', +r.split(':')[1]));
        else if (r.startsWith('dm:') && isDmMember(+r.slice(3), me.id)) addToRoom(ws, channelRoomId('dm', +r.slice(3)));
      }
      break;
    }
    case 'unsubscribe': {
      for (const r of (m.rooms || [])) meta.rooms.delete(r);
      break;
    }
    case 'msg:send': { // {t, kind:'guild'|'dm', channel_id, content, reply_to, attachment}
      const kind = m.kind === 'dm' ? 'dm' : 'guild';
      const cid = +m.channel_id;
      if (!cid || !canAccessChannel(me.id, kind, cid)) throw new Error('Kein Zugriff auf Kanal');
      const content = String(m.content || '').slice(0, 2000);
      const att = m.attachment && m.attachment.url ? JSON.stringify(m.attachment) : '';
      if (!content.trim() && !att) throw new Error('Leere Nachricht');
      if (rateLimited(me.id)) throw new Error('Zu schnell — warte kurz');
      const replyTo = m.reply_to ? (+m.reply_to) : null;
      const id = db.prepare('INSERT INTO messages(channel_id,channel_kind,sender_id,content,reply_to,attachment,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(cid, kind, me.id, content, replyTo, att, Date.now()).lastInsertRowid;
      const msg = hydrateMessages(db.prepare('SELECT * FROM messages WHERE id=?').all(id), me.id)[0];
      const room = channelRoomId(kind, cid);
      broadcastRoom(room, { t: 'msg:new', msg });
      markRead(me.id, kind, cid, id);
      notifyMentions(msg, kind, cid, me.id);
      break;
    }
    case 'msg:edit': {
      const row = db.prepare('SELECT * FROM messages WHERE id=?').get(+m.id);
      if (!row || row.sender_id !== me.id) throw new Error('Nur eigene Nachrichten bearbeiten');
      db.prepare('UPDATE messages SET content=?, edited_at=? WHERE id=?').run(String(m.content || '').slice(0, 2000), Date.now(), row.id);
      const msg = hydrateMessages(db.prepare('SELECT * FROM messages WHERE id=?').all(row.id), me.id)[0];
      broadcastRoom(channelRoomId(row.channel_kind, row.channel_id), { t: 'msg:update', msg });
      break;
    }
    case 'msg:delete': {
      const row = db.prepare('SELECT * FROM messages WHERE id=?').get(+m.id);
      if (!row) throw new Error('?');
      const allowed = row.sender_id === me.id ||
        (row.channel_kind === 'guild' && (memberPerms(db.prepare('SELECT guild_id FROM channels WHERE id=?').get(row.channel_id).guild_id, me.id) & (P.KICK | P.MANAGE_GUILD)));
      if (!allowed) throw new Error('Keine Berechtigung');
      db.prepare('UPDATE messages SET deleted=1, content=\'\' WHERE id=?').run(row.id);
      broadcastRoom(channelRoomId(row.channel_kind, row.channel_id), { t: 'msg:remove', id: row.id });
      break;
    }
    case 'msg:pin': {
      const row = db.prepare('SELECT * FROM messages WHERE id=?').get(+m.id);
      if (!row) throw new Error('?');
      if (row.channel_kind === 'guild') {
        const ch = db.prepare('SELECT guild_id FROM channels WHERE id=?').get(row.channel_id);
        if (!(memberPerms(ch.guild_id, me.id) & P.MANAGE_CHANNELS)) throw new Error('Keine Berechtigung');
      } else if (!isDmMember(row.channel_id, me.id)) throw new Error('Kein Zugriff');
      db.prepare('UPDATE messages SET pinned=? WHERE id=?').run(row.pinned ? 0 : 1, row.id);
      const msg = hydrateMessages(db.prepare('SELECT * FROM messages WHERE id=?').all(row.id), me.id)[0];
      broadcastRoom(channelRoomId(row.channel_kind, row.channel_id), { t: 'msg:update', msg });
      break;
    }
    case 'react': { // {t:'react', id, emoji, add:1|0}
      const row = db.prepare('SELECT * FROM messages WHERE id=?').get(+m.id);
      if (!row || row.deleted) throw new Error('?');
      if (!canAccessChannel(me.id, row.channel_kind, row.channel_id)) throw new Error('Kein Zugriff');
      const emoji = String(m.emoji).slice(0, 16);
      if (m.add) db.prepare('INSERT OR IGNORE INTO reactions(message_id,user_id,emoji) VALUES(?,?,?)').run(row.id, me.id, emoji);
      else db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?').run(row.id, me.id, emoji);
      broadcastRoom(channelRoomId(row.channel_kind, row.channel_id), { t: 'react:update', messageId: row.id, reactions: hydrateMessages([row], me.id)[0].reactions });
      break;
    }
    case 'typing': { // {t:'typing', kind, channel_id}
      const kind = m.kind === 'dm' ? 'dm' : 'guild';
      const cid = +m.channel_id;
      if (!canAccessChannel(me.id, kind, cid)) break;
      broadcastRoom(channelRoomId(kind, cid), { t: 'typing', channelId: cid, kind, user: { id: me.id, display_name: me.display_name, avatar_path: me.avatar_path, accent_color: me.accent_color } }, me.id);
      break;
    }
    case 'read': { // {t:'read', kind, channel_id, msg_id}
      markRead(me.id, m.kind === 'dm' ? 'dm' : 'guild', +m.channel_id, +m.msg_id || 0);
      break;
    }
    case 'presence:set': {
      const s = ['online','idle','dnd','invisible'].includes(m.status) ? m.status : 'online';
      db.prepare('UPDATE users SET status=? WHERE id=?').run(s, me.id);
      broadcastAll({ t: 'presence', userId: me.id, status: s });
      break;
    }
  }
}

function markRead(userId, kind, channelId, msgId) {
  if (!channelId) return;
  db.prepare(`INSERT INTO reads(user_id,channel_id,channel_kind,last_read_msg_id) VALUES(?,?,?,?)
    ON CONFLICT(user_id,channel_kind,channel_id) DO UPDATE SET last_read_msg_id=max(last_read_msg_id, excluded.last_read_msg_id)`)
    .run(userId, channelId, kind, msgId);
  sendToUser(userId, { t: 'read:set', kind, channelId, msgId });
}

function notifyMentions(msg, kind, channelId, senderId) {
  const targets = new Set();
  const content = msg.content || '';
  if (kind === 'guild') {
    const ch = db.prepare('SELECT guild_id FROM channels WHERE id=?').get(channelId);
    if (ch) {
      const members = db.prepare('SELECT user_id FROM members WHERE guild_id=? AND banned=0').all(ch.guild_id).map(x => x.user_id);
      if (/@everyone|@here/.test(content)) members.forEach(u => u !== senderId && targets.add(u));
      for (const uid of members) if (content.includes(`@${mentionName(uid)}`)) targets.add(uid);
    }
  } else {
    db.prepare('SELECT user_id FROM dm_participants WHERE dm_id=?').all(channelId).forEach(x => x.user_id !== senderId && targets.add(x.user_id));
  }
  for (const uid of targets) {
    if (uid === senderId) continue;
    sendToUser(uid, { t: 'notif', msg, kind, channelId });
  }
}
const nameCache = new Map();
function mentionName(uid) {
  if (!nameCache.has(uid)) {
    const u = db.prepare('SELECT username FROM users WHERE id=?').get(uid);
    nameCache.set(uid, u ? u.username : 'x');
  }
  return nameCache.get(uid);
}

module.exports = { attach, broadcastToGuild, sendToUser, channelRoomId, guildRoom };
