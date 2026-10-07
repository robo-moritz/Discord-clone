import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { api, WS } from './api';
import { Avatar, Modal, Confirm, Menu, ACCENTS, bannerStyle } from './ui';
import { ChannelView, ProfileCard } from './chat';
import './styles.css';
import { Settings, GuildSettings } from './settings';

/* ================= Auth-Screen ================= */
function Auth({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', display_name: '', password: '' });
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      const d = await api(mode === 'login' ? '/login' : '/register', { body: f });
      onLogin(d.user);
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 style={{ color: '#fff' }}>💬 BlurChat</h1>
        <div className="sub" style={{ color: 'rgba(255,255,255,.7)' }}>
          {mode === 'login' ? 'Willkommen zurück! Schön, dich zu sehen.' : 'Erstelle ein Konto — dauert 10 Sekunden.'}
        </div>
        {err && <div className="err">{err}</div>}
        <form onSubmit={submit}>
          <div className="field"><label>Benutzername</label>
            <input autoFocus value={f.username} onChange={e => setF({ ...f, username: e.target.value })} placeholder="z.B. max_mustermann" /></div>
          {mode === 'register' && <div className="field"><label>Anzeigename</label>
            <input value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} placeholder="Max 👋" /></div>}
          <div className="field"><label>Passwort</label>
            <input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="min. 6 Zeichen" /></div>
          <button className="btn" type="submit">{mode === 'login' ? 'Anmelden' : 'Registrieren'}</button>
        </form>
        <div className="switch-link">
          {mode === 'login' ? <>Noch kein Konto? <a onClick={() => setMode('register')}>Registrieren</a></>
            : <>Schon ein Konto? <a onClick={() => setMode('login')}>Anmelden</a></>}
        </div>
      </div>
    </div>
  );
}

/* ================= Rail (Serverliste) ================= */
function Rail({ ctx }) {
  const { guilds, selGuild, setSelGuild, openCreateGuild, openJoinGuild, homeActive, setHome } = ctx;
  return (
    <div className="rail">
      <div className="rail-item">
        <button className={`rail-btn home ${homeActive ? 'sel' : ''}`} onClick={setHome}>💬</button>
        <span className="rail-tip">Startseite</span>
        {ctx.dmUnread > 0 && <span className="badge-count">{ctx.dmUnread}</span>}
      </div>
      <div className="rail-sep" />
      {guilds.map(g => (
        <div key={g.id} className="rail-item">
          <button className={`rail-btn ${selGuild === g.id ? 'sel' : ''}`}
            style={!ctx.homeActive && selGuild === g.id ? { background: g.icon_color } : { background: g.unread ? undefined : undefined }}
            onClick={() => setSelGuild(g.id)}>
            {g.icon_emoji || g.name[0]}
          </button>
          {g.unread && !ctx.homeActive && selGuild !== g.id && <span className="unread-dot" />}
          <span className="rail-tip">{g.name}</span>
        </div>
      ))}
      <div className="rail-item"><button className="rail-add" onClick={openJoinGuild}>➕</button><span className="rail-tip">Server beitreten</span></div>
      <div className="rail-item"><button className="rail-add" onClick={openCreateGuild}>🏠</button><span className="rail-tip">Server erstellen</span></div>
    </div>
  );
}

/* ================= Sidebar (Kanäle / DM-Liste) ================= */
function GuildSidebar({ ctx }) {
  const { guild, channels, categories, members, selChannel, setSelChannel, perms, collapsedCats, toggleCat } = ctx;
  if (!guild) return null;
  const unreadSet = ctx.unreadChannels;
  return (
    <div className={`sidebar ${ctx.sidebarOpen ? 'open' : ''}`}>
      <div className="sb-header" onClick={ctx.openGuildMenu} ref={ctx.guildHeaderRef}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guild.name}</span>
        <span>⌄</span>
      </div>
      <div className="sb-scroll">
        {categories.map(cat => {
          const chans = channels.filter(c => c.category_id === cat.id);
          return (
            <div key={cat.id}>
              <div className="cat-label" onClick={() => toggleCat(cat.id)}>
                <span style={{ transform: collapsedCats.has(cat.id) ? 'rotate(-90deg)' : 'none', fontSize: 10 }}>▼</span>
                <span style={{ flex: 1 }}>{cat.name}</span>
                {(perms & 4) !== 0 && <button className="mini-btn" title="Kanal erstellen" onClick={e => { e.stopPropagation(); ctx.createChannelPrompt(cat.id); }}>＋</button>}
              </div>
              {!collapsedCats.has(cat.id) && chans.map(c => (
                <div key={c.id} className={`chan ${selChannel === c.id ? 'sel' : ''} ${unreadSet.has(c.id) ? 'unread' : ''}`}
                  onClick={() => setSelChannel(c.id)}
                  onContextMenu={e => (perms & 4) !== 0 && ctx.channelMenu(e, c)}>
                  <span className="hash">#</span><span className="chan-name">{c.name}</span>
                </div>
              ))}
            </div>
          );
        })}
        {channels.filter(c => !c.category_id).map(c => (
          <div key={c.id} className={`chan ${selChannel === c.id ? 'sel' : ''}`} onClick={() => setSelChannel(c.id)}>
            <span className="hash">#</span><span className="chan-name">{c.name}</span>
          </div>
        ))}
        <div style={{ height: 12 }} />
      </div>
      <UserPanel ctx={ctx} />
    </div>
  );
}

function HomeSidebar({ ctx }) {
  const { dms, friends, selDm, setSelDm } = ctx;
  return (
    <div className={`sidebar ${ctx.sidebarOpen ? 'open' : ''}`}>
      <div className="sb-header" style={{ cursor: 'default' }}>BlurChat</div>
      <div className="sb-scroll">
        <div className="chan" style={{ fontWeight: 600 }} onClick={ctx.showFriends}>👥 Freunde</div>
        <div className="section-title">Sprach-/Text-DMs</div>
        {dms.map(d => {
          const other = d.participants.find(p => p.id !== ctx.me.id);
          const name = d.is_group ? d.name : other?.display_name;
          return (
            <div key={d.id} className={`chan ${selDm === d.id ? 'sel' : ''}`} onClick={() => setSelDm(d.id)}
              onContextMenu={e => ctx.dmMenu(e, d)}>
              {d.is_group ? <span>👥</span> : <Avatar user={other} size="xs" />}
              <span className="chan-name">{name}</span>
              {ctx.unreadChannels.has(`dm:${d.id}`) && <span className="unread-dot" style={{ position: 'static', border: 'none', width: 8, height: 8 }} />}
            </div>
          );
        })}
        {dms.length === 0 && <div style={{ padding: '8px', fontSize: 13, color: 'var(--faint)' }}>Noch keine DMs.<br />Öffne ein Profil und klicke „Nachricht senden“.</div>}
      </div>
      <UserPanel ctx={ctx} />
    </div>
  );
}

/* ================= UserPanel unten links ================= */
function UserPanel({ ctx }) {
  const { me } = ctx;
  return (
    <div className="sb-footer">
      <div className="me-info" onClick={e => ctx.showProfile(me.id, e.currentTarget)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Avatar user={me} size="sm" showStatus />
        <div style={{ minWidth: 0 }}>
          <div className="me-name" style={{ color: me.accent_color || undefined }}>{me.display_name}</div>
          <div className="me-sub">{me.status_text || '@' + me.username}</div>
        </div>
      </div>
      <button className="mini-btn" title="Status ändern" onClick={ctx.statusMenu} ref={ctx.statusBtnRef}>
        <span className="status-dot {me.status}" style={{ position: 'static', border: 'none', display: 'block', width: 12, height: 12, borderRadius: '50%', background: `var(--${me.status === 'invisible' ? 'offline' : me.status})` }} />
      </button>
      <button className="mini-btn" title="Einstellungen" onClick={ctx.openSettings}>⚙️</button>
    </div>
  );
}

/* ================= Mitgliederliste ================= */
function MemberList({ ctx }) {
  const { members, roles, presence, perms, me } = ctx;
  if (!ctx.membersOpen || !ctx.guild) return null;
  const hoisted = roles.filter(r => r.hoist);
  const byStatus = s => members.filter(m => (presence[m.user_id] || m.status || 'offline') === s);
  const roleColor = uid => {
    const m = members.find(x => x.user_id === uid);
    if (!m) return null;
    for (const r of [...roles].sort((a, b) => b.position - a.position))
      if ((r.managed || m.role_ids.includes(r.id)) && r.color) return r.color;
    return null;
  };
  ctx.roleColorOf = roleColor;
  const groups = [];
  for (const r of hoisted.sort((a, b) => b.position - a.position)) {
    const list = members.filter(m => m.role_ids.includes(r.id) && ['online', 'idle', 'dnd'].includes(presence[m.user_id] || m.status));
    if (list.length) groups.push([r.name, list, r.color]);
  }
  const online = members.filter(m => ['online', 'idle', 'dnd'].includes(presence[m.user_id] || m.status) && !hoisted.some(r => m.role_ids.includes(r.id)));
  if (online.length) groups.push(['Online', online]);
  const offline = members.filter(m => !['online', 'idle', 'dnd'].includes(presence[m.user_id] || m.status));
  if (offline.length) groups.push(['Offline', offline]);
  return (
    <div className="memberlist">
      {groups.map(([name, list, color]) => (
        <div key={name}>
          <div className="mem-cat" style={color ? { color } : null}>{name.toUpperCase()} — {list.length}</div>
          {list.map(m => (
            <div key={m.user_id} className={`mem ${list === offline ? 'offline' : ''}`}
              onClick={e => ctx.showProfile(m.user_id, e.currentTarget)}
              onContextMenu={e => { if (m.user_id !== me.id && (perms & (1 | 2))) ctx.memberMenu(e, m); }}>
              <Avatar user={m} showStatus status={presence[m.user_id] || m.status} />
              <div style={{ minWidth: 0 }}>
                <div className="mem-name" style={{ color: roleColor(m.user_id) || m.accent_color || undefined }}>{m.display_name}</div>
                {m.status_text && <div className="mem-sub">{m.status_text}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ================= Startseite / Freunde ================= */
function FriendsView({ ctx }) {
  const { friends, incoming, outgoing, findQ, findResults } = ctx;
  const [addTab, setAddTab] = useState(false);
  const online = friends.filter(f => (ctx.presence[f.id] || f.status) !== 'offline');
  return (
    <div className="main">
      <div className="chat-header">
        <span style={{ fontWeight: 600, fontSize: 16 }}>👥 Freunde</span>
        <div className="hdr-btns" style={{ marginLeft: 16 }}>
          <span className={`tab ${!addTab ? 'sel' : ''}`} onClick={() => setAddTab(false)}>Alle — {friends.length}</span>
          <span className={`tab ${addTab ? 'sel' : ''}`} onClick={() => setAddTab(true)} style={{ color: 'var(--green)' }}>Freund hinzufügen</span>
        </div>
      </div>
      <div className="home-main">
        {addTab ? (
          <div>
            <input placeholder="Nutzer mit @benutzername suchen…" style={{ width: '100%' }} value={findQ}
              onChange={e => ctx.findUsers(e.target.value)} />
            {incoming.length > 0 && <><div className="section-title">Eingehende Anfragen</div>
              {incoming.map(u => <FriendRow key={u.id} u={u} ctx={ctx} incoming />)}</>}
            {outgoing.length > 0 && <><div className="section-title">Ausgehende Anfragen</div>
              {outgoing.map(u => <FriendRow key={u.id} u={u} ctx={ctx} outgoing />)}</>}
            {findResults.map(u => (
              <div key={u.id} className="friend-row">
                <Avatar user={u} showStatus />
                <div style={{ minWidth: 0 }}><b>{u.display_name}</b><div className="mem-sub">@{u.username}</div></div>
                <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => ctx.sendFriendReq(u.id)}>Anfrage senden</button>
              </div>
            ))}
          </div>
        ) : (
          <>
            {incoming.length > 0 && <><div className="section-title">Offene Anfragen ({incoming.length})</div>
              {incoming.map(u => <FriendRow key={u.id} u={u} ctx={ctx} incoming />)}</>}
            {online.length > 0 && <div className="section-title">Online — {online.length}</div>}
            {online.map(f => <FriendRow key={f.id} u={f} ctx={ctx} />)}
            {friends.length === 0 && <div style={{ textAlign: 'center', color: 'var(--faint)', marginTop: 60 }}>
              Noch keine Freunde. Wechsle auf „Freund hinzufügen“ und such nach Nutzern! 🎉</div>}
            {friends.length > 0 && online.length === 0 && <div className="section-title">Offline</div>}
            {friends.filter(f => !online.includes(f)).map(f => <FriendRow key={f.id} u={f} ctx={ctx} />)}
          </>
        )}
      </div>
    </div>
  );
}

function FriendRow({ u, ctx, incoming, outgoing }) {
  const st = ctx.presence[u.id] || u.status || 'offline';
  return (
    <div className="friend-row" onClick={() => !incoming && !outgoing && ctx.showProfile(u.id, document.activeElement)}>
      <Avatar user={u} showStatus status={st} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{u.display_name}</div>
        <div className="mem-sub">{incoming ? 'Anfrage eingegangen' : outgoing ? 'Anfrage ausstehend' : '@' + u.username + ' · ' + (st === 'online' ? 'Online' : st === 'idle' ? 'Abwesend' : st === 'dnd' ? 'Nicht stören' : 'Offline')}</div>
      </div>
      <div className="friend-actions" style={{ opacity: incoming || outgoing ? 1 : undefined }}>
        {incoming && <button title="Annehmen" onClick={e => { e.stopPropagation(); ctx.acceptFriend(u.id); }}>✔</button>}
        {(incoming || outgoing) && <button title="Ablehnen" onClick={e => { e.stopPropagation(); ctx.removeFriend(u.id); }}>✕</button>}
        {!incoming && !outgoing && <>
          <button title="Nachricht" onClick={e => { e.stopPropagation(); ctx.openDm(u.id); }}>💬</button>
          <button title="Profil" onClick={e => { e.stopPropagation(); ctx.showProfile(u.id, e.currentTarget); }}>👤</button>
          <button title="Entfernen" onClick={e => { e.stopPropagation(); ctx.removeFriend(u.id); }}>🗑</button>
        </>}
      </div>
    </div>
  );
}

/* ================= App ================= */
function App() {
  const [me, setMe] = useState(undefined); // undefined = lädt, null = nicht angemeldet
  const [guilds, setGuilds] = useState([]);
  const [dms, setDms] = useState([]);
  const [friendsData, setFriendsData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [selGuild, setSelGuild] = useState(null);
  const [selChannel, setSelChannel] = useState(null);
  const [selDm, setSelDm] = useState(null);
  const [homeActive, setHomeActive] = useState(true);
  const [guildDetail, setGuildDetail] = useState(null);
  const [reads, setReads] = useState({});
  const [presence, setPresence] = useState({});
  const [profile, setProfile] = useState(null);
  const [menu, setMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [membersOpen, setMembersOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const wsRef = useRef(null);
  const jumpHandler = useRef(null);
  const soundOn = me?.settings?.sound !== false;

  const toast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2600); };

  /* Session laden */
  useEffect(() => { api('/me').then(d => setMe(d.user)).catch(() => setMe(null)); }, []);
  useEffect(() => { if (me) document.documentElement.dataset.theme = me.settings?.theme || 'dark'; }, [me]);

  /* Daten laden */
  const reloadGuilds = useCallback(async () => {
    const { guilds } = await api('/guilds');
    setGuilds(guilds);
    if (guilds.length && !selGuild) { setSelGuild(guilds[0].id); }
  }, [selGuild]);
  const reloadDms = useCallback(async () => { const { dms } = await api('/dms'); setDms(dms); }, []);
  const reloadFriends = useCallback(async () => { setFriendsData(await api('/friends')); }, []);

  useEffect(() => { if (me) { reloadGuilds(); reloadDms(); reloadFriends(); } }, [!!me]);

  const reloadGuild = useCallback(async gid => {
    const d = await api(`/guilds/${gid}`);
    setGuildDetail(d);
    setReads(Object.fromEntries((d.reads || []).map(r => [`${r.channel_kind}:${r.channel_id}`, r.last_read_msg_id])));
    if (!selChannel || !d.channels.some(c => c.id === selChannel)) setSelChannel(d.channels[0]?.id || null);
  }, [selChannel]);

  useEffect(() => { if (selGuild) { setGuildDetail(null); setSelChannel(null); reloadGuild(selGuild); } }, [selGuild]);

  /* WebSocket */
  useEffect(() => {
    if (!me) return;
    const ws = new WS();
    wsRef.current = ws;
    ws.on(async m => {
      switch (m.t) {
        case 'presence': setPresence(p => ({ ...p, [m.userId]: m.status })); break;
        case 'read:set': setReads(r => ({ ...r, [`${m.kind}:${m.channelId}`]: m.msgId })); break;
        case 'notif': playPing(); notifyNotif(m); break;
        case 'friend:request': case 'friend:accepted': reloadFriends(); toast(m.t === 'friend:request'
          ? `Neue Freundschaftsanfrage von @${m.from.username}` : `@${m.by.username} hat deine Anfrage angenommen 🎉`); break;
        case 'msg:new': {
          playPingSoft();
          if (m.msg.channel_kind === 'dm') reloadDms();
          if (m.msg.channel_kind === 'guild') reloadGuilds();
          break;
        }
        case 'member:join': case 'member:leave': case 'member:update': case 'role:new': case 'role:update': case 'role:delete':
        case 'channel:new': case 'channel:update': case 'channel:delete': case 'category:new': case 'guild:update':
          if (selGuild) reloadGuild(selGuild); break;
        case 'guild:delete':
          if (selGuild === m.guildId) { setSelGuild(null); setGuildDetail(null); }
          reloadGuilds(); break;
        default: break;
      }
    });
    return () => { ws.sock && ws.sock.close(); };
  }, [!!me]);

  function playPing() {
    if (!soundOn) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.frequency.value = 880; g.gain.setValueAtTime(.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .3);
      o.start(); o.stop(ac.currentTime + .3);
    } catch {}
  }
  const playPingSoft = () => {};
  function notifyNotif(m) {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`${m.msg.sender.display_name}:`, { body: m.msg.content.slice(0, 100) });
    }
  }

  /* Ungelesen-Berechnung für Sidebar */
  const unreadChannels = new Set();
  for (const [key, last] of Object.entries(reads)) {
    // wird über letzte Message-IDs gefüllt — hier einfach via guild-detail last ids
  }
  if (guildDetail) {
    // wir brauchen letzte Message-ID pro Kanal: nutzen wir messages beim Laden — vereinfacht über hasUnread der API
  }
  const guildUnread = new Set(guilds.filter(g => g.unread).map(g => g.id));

  /* ---- Context für Kinder ---- */
  const ws = { send: (...a) => wsRef.current?.send(...a) };
  const ctx = {
    me, ws, perms: guildDetail?.guild?.perms || 0,
    guild: guildDetail?.guild, categories: guildDetail?.categories || [], channels: guildDetail?.channels || [],
    roles: guildDetail?.roles || [], members: guildDetail?.members || [],
    guilds, dms, friends: friendsData.friends, incoming: friendsData.incoming, outgoing: friendsData.outgoing,
    presence, reads, selGuild, selChannel, selDm, homeActive, membersOpen, sidebarOpen, replyTo, collapsedCats,
    unreadChannels, roleColorOf: null,
    setSelGuild: id => { setSelGuild(id); setHomeActive(false); },
    setSelChannel, setSelDm: id => { setSelDm(id); setHomeActive(false); },
    setHome: () => setHomeActive(true),
    showFriends: () => { setHomeActive(true); setSelDm(null); },
    setReplyTo, toggleMembers: () => setMembersOpen(o => !o),
    toggleCat: id => setCollapsedCats(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    readOf: (kind, id) => reads[`${kind}:${id}`] || 0,
    userName: id => guildDetail?.members?.find(m => m.user_id === id)?.display_name || me?.display_name,
    reloadGuilds, reloadGuild, setMe, toast,
    jumpTo: id => jumpHandler.current && jumpHandler.current(id),
    setJumpHandler: fn => { jumpHandler.current = fn; },
    showProfile: (userId, anchor) => setProfile({ userId, anchor }),
    openDm: async userId => {
      const { dm } = await api('/dms/open', { body: { user_id: userId } });
      await reloadDms(); setSelDm(dm.id); setHomeActive(false); setProfile(null);
    },
    kickMember: uid => setConfirm({ text: 'Mitglied wirklich vom Server entfernen?', fn: () => api(`/guilds/${selGuild}/kick/${uid}`, { body: {} }).then(() => { reloadGuild(selGuild); toast('Mitglied entfernt'); }) }),
    banMember: uid => setConfirm({ text: 'Mitglied bannen? Er/sie kann nicht mehr beitreten.', danger: true, fn: () => api(`/guilds/${selGuild}/ban/${uid}`, { body: {} }).then(() => { reloadGuild(selGuild); toast('Gebannt 🔨'); }) }),
    memberMenu: (e, m) => {
      e.preventDefault();
      const items = [{ label: 'Profil ansehen', fn: () => setProfile({ userId: m.user_id, anchor: e.currentTarget }) }];
      if (perms & 1) items.push({ label: 'Kicken', red: true, fn: () => ctx.kickMember(m.user_id) });
      if (perms & 2) items.push({ label: 'Bannen', red: true, fn: () => ctx.banMember(m.user_id) });
      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    statusMenu: e => {
      const cur = me.status;
      setMenu({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top - 130, items: [
        { label: '🟢 Online', fn: () => setStatus('online') },
        { label: '🌙 Abwesend', fn: () => setStatus('idle') },
        { label: '⛔ Nicht stören', fn: () => setStatus('dnd') },
        { label: '👻 Unsichtbar', fn: () => setStatus('invisible') },
        { sep: true }, { label: cur === 'online' ? 'Status zurücksetzen' : 'Zurück zu Online', fn: () => setStatus('online') },
      ] });
    },
    openSettings: () => setModal({ kind: 'settings' }),
    openCreateGuild: () => setModal({ kind: 'createGuild' }),
    openJoinGuild: () => setModal({ kind: 'joinGuild' }),
    openGuildMenu: e => {
      if (!(ctx.perms & 8) && !(guildDetail?.guild?.owner_id === me.id)) return setModal({ kind: 'guildInfo' });
      setModal({ kind: 'guildSettings' });
    },
    createChannelPrompt: catId => setModal({ kind: 'newChannel', catId }),
    createCategoryPrompt: () => setModal({ kind: 'newCategory' }),
    editChannel: ch => setModal({ kind: 'editChannel', ch }),
    deleteChannel: ch => setConfirm({ text: `Kanal #${ch.name} wirklich löschen? Alle Nachrichten gehen verloren.`, danger: true, fn: () => api(`/channels/${ch.id}`, { method: 'DELETE' }).then(() => reloadGuild(selGuild)) }),
    channelMenu: (e, c) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: 'Kanal bearbeiten', fn: () => ctx.editChannel(c) },
      { label: 'Kanal löschen', red: true, fn: () => ctx.deleteChannel(c) }] }); },
    deleteRole: id => api(`/roles/${id}`, { method: 'DELETE' }).then(() => reloadGuild(selGuild)),
    confirmDeleteGuild: () => setConfirm({ text: 'Server wirklich unwiderruflich löschen?', danger: true, fn: () => api(`/guilds/${selGuild}`, { method: 'DELETE' }).then(() => { setSelGuild(null); reloadGuilds(); }) }),
    dmMenu: (e, d) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: 'Schließen (aus Liste)', red: true, fn: () => { setSelDm(null); toast('DM geschlossen — bleibt aber bestehen'); } }] }); },
    sendFriendReq: uid => api(`/friends/request/${uid}`, { body: {}, method: 'POST' }).then(() => { reloadFriends(); toast('Anfrage gesendet ✉️'); }).catch(e => toast(e.message)),
    acceptFriend: uid => api(`/friends/accept/${uid}`, { body: {}, method: 'POST' }).then(reloadFriends).catch(e => toast(e.message)),
    removeFriend: uid => api(`/friends/${uid}`, { method: 'DELETE' }).then(reloadFriends),
    findQ: '', findResults: [],
    findUsers: q => { ctx.findQ = q; if (q.length > 1) api(`/users/find?q=${encodeURIComponent(q)}`).then(d => ctx.findResults = d.users); else ctx.findResults = []; },
    canPin: (ctx.perms & 4) !== 0,
    notify: (title, body) => { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body }); },
  };
  function setStatus(s) { api('/status', { method: 'PUT', body: { status: s } }); setMe({ ...me, status: s }); ws.send({ t: 'presence:set', status: s }); }

  if (me === undefined) return <div className="auth-page"><div className="auth-card"><h1>💬 BlurChat</h1><div className="sub">Lädt…</div></div></div>;
  if (me === null) return <Auth onLogin={u => setMe(u)} />;

  const channel = ctx.channels.find(c => c.id === selChannel);
  const dm = dms.find(d => d.id === selDm);

  return (
    <div className="app">
      <Rail ctx={{ ...ctx, guilds: guilds.map(g => ({ ...g, unread: guildUnread.has(g.id) })), openGuildMenu: ctx.openGuildMenu }} />
      {homeActive ? <HomeSidebar ctx={ctx} /> : <GuildSidebar ctx={ctx} />}
      {homeActive
        ? (selDm && dm ? <ChannelView kind="dm" channelId={selDm} dm={dm} ctx={ctx} /> : <FriendsView ctx={ctx} />)
        : (channel ? <ChannelView kind="guild" channelId={selChannel} channel={channel} ctx={ctx} />
          : <div className="main" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--faint)' }}>Kein Kanal ausgewählt.</div>)}
      <MemberList ctx={ctx} />

      {profile && <ProfileCard userId={profile.userId} ctx={ctx} onClose={() => setProfile(null)} />}
      {menu && <Menu {...menu} onClose={() => setMenu(null)} />}
      {confirm && <Confirm {...confirm} onCancel={() => setConfirm(null)} onYes={() => { confirm.fn(); setConfirm(null); }} />}
      {modal?.kind === 'settings' && <Settings me={me} setMe={setMe} toast={toast} onClose={() => setModal(null)} />}
      {modal?.kind === 'guildSettings' && <GuildSettings guild={ctx.guild} ctx={ctx} close={() => setModal(null)} toast={toast} />}
      {modal?.kind === 'createGuild' && <CreateGuildModal ctx={ctx} close={() => setModal(null)} />}
      {modal?.kind === 'joinGuild' && <JoinGuildModal ctx={ctx} close={() => setModal(null)} />}
      {modal?.kind === 'guildInfo' && (
        <Modal title={ctx.guild?.name} onClose={() => setModal(null)}>
          <div className="hint">Invite-Code: <b style={{ fontFamily: 'monospace' }}>{ctx.guild?.invite_code}</b></div>
          <div className="hint" style={{ marginTop: 8 }}>{ctx.members?.length || 0} Mitglieder</div>
        </Modal>)}
      {(modal?.kind === 'newChannel' || modal?.kind === 'editChannel') && (
        <ChannelModal ctx={ctx} modal={modal} close={() => setModal(null)} />)}
      {modal?.kind === 'newCategory' && <CategoryModal ctx={ctx} close={() => setModal(null)} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

function CreateGuildModal({ ctx, close }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🚀');
  const [color, setColor] = useState('#5865f2');
  return (
    <Modal title="Einen Server erstellen" onClose={close} footer={<>
      <button className="btn secondary small" onClick={close}>Abbrechen</button>
      <button className="btn small" disabled={!name.trim()} onClick={async () => {
        const d = await api('/guilds', { body: { name, icon_emoji: emoji, icon_color: color } });
        await ctx.reloadGuilds(); ctx.setSelGuild(d.guild.id); close();
      }}>Erstellen</button></>}>
      <div className="field"><label>Servername</label><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Mein cooler Server" /></div>
      <div className="field"><label>Icon-Emoji</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['🚀', '🎮', '💬', '🏰', '⚔️', '🌈', '🐍', '🔥', '⭐', '🎨', '🍕', '🤖'].map(e =>
            <button key={e} className="emoji-cell" style={emoji === e ? { background: 'var(--blurple)' } : null} onClick={() => setEmoji(e)}>{e}</button>)}
        </div></div>
      <div className="field"><label>Farbe</label><div className="color-grid">{ACCENTS.map(c =>
        <button key={c} className={`color-swatch ${color === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}</div></div>
    </Modal>
  );
}

function JoinGuildModal({ ctx, close }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title="Server beitreten" onClose={close} footer={<>
      <button className="btn secondary small" onClick={close}>Abbrechen</button>
      <button className="btn small" disabled={!code.trim()} onClick={async () => {
        try {
          const d = await api('/guilds/join', { body: { code } });
          await ctx.reloadGuilds(); ctx.setSelGuild(d.guild.id); close();
        } catch (e) { setErr(e.message); }
      }}>Beitreten</button></>}>
      {err && <div className="err">{err}</div>}
      <div className="field"><label>Invite-Code</label>
        <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="z.B. A1B2C3D4" style={{ letterSpacing: 2, fontFamily: 'monospace' }} /></div>
      <div className="hint">Den Code bekommst du vom Server-Ersteller unter ⚙ → Einladung.</div>
    </Modal>
  );
}

function ChannelModal({ ctx, modal, close }) {
  const editing = modal.kind === 'editChannel';
  const [name, setName] = useState(editing ? modal.ch.name : '');
  const [topic, setTopic] = useState(editing ? modal.ch.topic : '');
  return (
    <Modal title={editing ? `#${modal.ch.name} bearbeiten` : 'Neuer Textkanal'} onClose={close} footer={<>
      <button className="btn secondary small" onClick={close}>Abbrechen</button>
      <button className="btn small" disabled={!name.trim()} onClick={async () => {
        if (editing) await api(`/channels/${modal.ch.id}`, { method: 'PUT', body: { name, topic } });
        else await api(`/guilds/${ctx.selGuild}/channels`, { body: { name, topic, category_id: modal.catId } });
        await ctx.reloadGuild(ctx.selGuild); close();
      }}>{editing ? 'Speichern' : 'Erstellen'}</button></>}>
      <div className="field"><label>Name</label><input autoFocus value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="mein-kanal" /></div>
      <div className="field"><label>Thema (optional)</label><input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Worum geht's hier?" /></div>
    </Modal>
  );
}

function CategoryModal({ ctx, close }) {
  const [name, setName] = useState('');
  return (
    <Modal title="Neue Kategorie" onClose={close} footer={<>
      <button className="btn secondary small" onClick={close}>Abbrechen</button>
      <button className="btn small" disabled={!name.trim()} onClick={async () => {
        await api(`/guilds/${ctx.selGuild}/categories`, { body: { name } });
        await ctx.reloadGuild(ctx.selGuild); close();
      }}>Erstellen</button></>}>
      <div className="field"><label>Name</label><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Textkanäle" /></div>
    </Modal>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
