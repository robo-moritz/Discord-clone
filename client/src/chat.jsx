import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { api, WS } from './api';
import { Avatar, renderContent, fmtTime, Modal, Confirm, Menu, ACCENTS, bannerStyle } from './ui';

const EMPTY = {};

/* ---------- Profil-Popover (Banner, Avatar, Bio, Badges, Aktionen) ---------- */
export function ProfileCard({ userId, ctx, onClose }) {
  const [data, setData] = useState(null);
  const [pos, setPos] = useState({ x: innerWidth / 2 - 150, y: 80 });
  const ref = useRef();
  useEffect(() => {
    api(`/users/${userId}/profile`).then(setData).catch(onClose);
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', h), 50);
    return () => document.removeEventListener('mousedown', h);
  }, [userId]);
  // position an Klick-Koordinate kleben (ctx.anchor = Element)
  useEffect(() => {
    if (ctx.anchor && ref.current) {
      const r = ctx.anchor.getBoundingClientRect();
      const w = 300, hgt = Math.min(ref.current.offsetHeight || 420, innerHeight - 20);
      let x = r.right + 8, y = r.bottom - hgt;
      if (x + w > innerWidth - 8) x = Math.max(8, r.left - w - 8);
      if (y < 8) y = 8;
      setPos({ x, y });
    }
  }, [data, ctx.anchor]);
  if (!data) return null;
  const u = data.user;
  const inGuild = ctx.guild?.members?.some(m => m.user_id === u.id);
  const isMe = ctx.me.id === u.id;
  return (
    <div className="popover profile-card" ref={ref} style={{ left: pos.x, top: pos.y }}>
      <div className="banner" style={{ ...bannerStyle(u), height: u.banner_path || u.banner_css ? 120 : 90 }} />
      <div className="pc-body">
        <div style={{ width: 96, marginTop: -56, border: '6px solid var(--chat)', borderRadius: '50%', background: 'var(--chat)' }}>
          <Avatar user={u} size="lg" showStatus status={u.status} />
        </div>
        <div className="pc-names" style={{ marginTop: 8 }}>
          <span className="pc-name" style={{ color: u.accent_color || undefined }}>{u.display_name}</span>
          {data.badges.length > 0 && <span className="badges">{data.badges.map(b => <span key={b} className="badge" title={b}>{b === 'OWNER' ? '👑' : b === 'EARLY' ? '🌟' : b === 'SCRIPTER' ? '📜' : b === 'ANNIV' ? '🎂' : '🎖️'}</span>)}</span>}
        </div>
        <div className="pc-accent">@{u.username}{u.pronouns ? ` · ${u.pronouns}` : ''}</div>
        {u.status_text && <div style={{ marginTop: 8, fontSize: 14 }}>{u.status_text}</div>}
        {u.bio && <div className="pc-bio">{u.bio}</div>}
        {data.common_guilds.length > 0 && <>
          <div className="pc-section-title">Gemeinsame Server</div>
          {data.common_guilds.map(g => <div key={g.id} style={{ fontSize: 13, padding: '3px 0', color: 'var(--muted)' }}>⬤ {g.name}</div>)}
        </>}
        {!isMe && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            <button className="btn" onClick={() => { ctx.openDm(u.id); onClose(); }}>💬 Nachricht senden</button>
            {ctx.guild && !inGuild && (ctx.perms & 1) !== 0 && (
              <button className="btn danger" onClick={() => { ctx.kickMember(u.id); onClose(); }}>Mitglied vom Server entfernen</button>
            )}
            {ctx.guild && !inGuild && (ctx.perms & 2) !== 0 && (
              <button className="btn danger" onClick={() => { ctx.banMember(u.id); onClose(); }}>Mitglied bannen</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Nachrichten-Zeile ---------- */
function Message({ msg, ctx, grouped, usernames }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [hoverReact, setHoverReact] = useState(false);
  const canDelete = msg.sender.id === ctx.me.id || (ctx.perms & (1 | 8)) !== 0;
  const save = () => {
    if (editText.trim() && editText !== msg.content) ctx.ws.send({ t: 'msg:edit', id: msg.id, content: editText });
    setEditing(false);
  };
  if (msg.system) return <div className="sys-msg"><span>{renderContent(msg.content, ctx.me.id, usernames)}</span><span className="msg-time">{fmtTime(msg.created_at)}</span></div>;
  if (msg.deleted) return (
    <div className={`msg-row ${grouped ? '' : 'first'}`}>
      <div className="msg-avatar" />
      <div className="msg-content"><span className="deleted-msg">Nachricht gelöscht · <button style={{ color: 'var(--blurple)' }} onClick={() => ctx.ws.send({ t: 'msg:delete', id: msg.id })}>Löschen rückgängig machen?</button></span></div>
    </div>
  );
  const authorColor = ctx.roleColorOf?.(msg.sender.id) || msg.sender.accent_color || undefined;
  return (
    <div className={`msg-row ${grouped ? '' : 'first'}`} data-mid={msg.id} onDoubleClick={() => msg.sender.id === ctx.me.id && setEditing(true)}>
      <div className="msg-avatar">
        {!grouped ? <Avatar user={msg.sender} onClick={e => ctx.showProfile(msg.sender.id, e.currentTarget)} />
          : <span className="msg-time" style={{ opacity: 0, fontSize: 10, paddingTop: 4 }}>{new Date(msg.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      <div className="msg-content">
        {msg.reply && (
          <div className="reply-ref" onClick={() => ctx.jumpTo(msg.reply.id)}>
            <Avatar user={msg.reply.author} size="xs" />
            <span className="reply-name" style={{ color: msg.reply.author?.accent_color || undefined }}>{msg.reply.author?.display_name}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{msg.reply.content}</span>
          </div>
        )}
        {!grouped && (
          <div className="msg-head">
            <span className="msg-author" style={{ color: authorColor }} onClick={e => ctx.showProfile(msg.sender.id, e.currentTarget)}>{msg.sender.display_name}</span>
            {msg.pinned ? <span className="pinned-flag">📌 angeheftet</span> : null}
            <span className="msg-time">{fmtTime(msg.created_at)}</span>
          </div>
        )}
        {editing ? (
          <div>
            <textarea autoFocus value={editText} rows={2} style={{ width: '100%' }}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') setEditing(false); }} />
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enter zum Speichern · Esc zum Abbrechen</div>
          </div>
        ) : (
          <div className="msg-body">
            {renderContent(msg.content, ctx.me.id, usernames)}
            {msg.edited_at && <span className="edited">(bearbeitet)</span>}
            {msg.attachment?.url && (/image/.test(msg.attachment.mime || '')
              ? <img className="msg-img" src={msg.attachment.url} alt={msg.attachment.name} onClick={() => window.open(msg.attachment.url)} />
              : <a href={msg.attachment.url} download={msg.attachment.name} style={{ display: 'block', marginTop: 4 }}>📎 {msg.attachment.name}</a>)}
          </div>
        )}
        {Object.keys(msg.reactions || {}).length > 0 && (
          <div className="reactions">
            {Object.entries(msg.reactions).map(([emoji, r]) => (
              <button key={emoji} className={`react-pill ${r.me ? 'mine' : ''}`} title={r.uids?.length}
                onClick={() => ctx.ws.send({ t: 'react', id: msg.id, emoji, add: r.me ? 0 : 1 })}>
                <span>{emoji}</span><span className="cnt">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {!editing && (
        <div className="msg-actions">
          <div style={{ position: 'relative' }}
            onMouseEnter={() => setHoverReact(true)} onMouseLeave={() => setHoverReact(false)}>
            <button className="act-btn" title="Reagieren">😊</button>
            {hoverReact && <QuickReactions onPick={em => ctx.ws.send({ t: 'react', id: msg.id, emoji: em, add: 1 })} />}
          </div>
          <button className="act-btn" title="Antworten" onClick={() => ctx.setReplyTo(msg)}>↩</button>
          {ctx.canPin && <button className="act-btn" title="Anheften" onClick={() => ctx.ws.send({ t: 'msg:pin', id: msg.id })}>📌</button>}
          {msg.sender.id === ctx.me.id && <button className="act-btn" title="Bearbeiten" onClick={() => { setEditText(msg.content); setEditing(true); }}>✏️</button>}
          {canDelete && <button className="act-btn" title="Löschen" onClick={() => ctx.ws.send({ t: 'msg:delete', id: msg.id })}>🗑️</button>}
        </div>
      )}
    </div>
  );
}

function QuickReactions({ onPick }) {
  return (
    <div style={{ position: 'absolute', bottom: 34, right: 0, background: 'var(--chat)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', padding: 4, zIndex: 10 }}>
      {['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉'].map(e => <button key={e} className="act-btn" onClick={() => onPick(e)}>{e}</button>)}
    </div>
  );
}

/* ---------- Haupt-Chatbereich für Kanal oder DM ---------- */
export function ChannelView({ kind, channelId, channel, dm, ctx }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attach, setAttach] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [showEmoji, setShowEmoji] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState(null);
  const [mentionPopup, setMentionPopup] = useState(null);
  const [jumpTarget, setJumpTarget] = useState(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const listRef = useRef();
  const taRef = useRef();
  const atBottom = useRef(true);
  const replyTo = ctx.replyTo;

  const load = useCallback(async (before = 0) => {
    const url = kind === 'dm' ? `/dms/${channelId}/messages${before ? `?before=${before}` : ''}`
      : `/channels/${channelId}/messages${before ? `?before=${before}` : ''}`;
    const { messages } = await api(url);
    if (before) setMessages(old => [...messages, ...old]);
    else { setMessages(messages); requestAnimationFrame(() => scrollBottom()); }
  }, [kind, channelId]);

  useEffect(() => {
    setMessages([]); ctx.setReplyTo(null); setSearchQ(''); setResults(null);
    load();
    ctx.ws.send({ t: 'subscribe', rooms: [kind === 'dm' ? `dm:${channelId}` : `guild:${channelId}`] });
    const last = messages[messages.length - 1];
    if (last) ctx.ws.send({ t: 'read', kind, channel_id: channelId, msg_id: last.id });
    return () => { ctx.ws.send({ t: 'unsubscribe', rooms: [kind === 'dm' ? `dm:${channelId}` : `guild:${channelId}`] }); };
  }, [kind, channelId]);

  // Live-Events
  useEffect(() => ctx.ws.on(m => {
    const room = kind === 'dm' ? `dm:${channelId}` : `guild:${channelId}`;
    if (m.t === 'msg:new' && `${m.msg.channel_kind}:${m.msg.channel_id}` === room) {
      setMessages(old => {
        if (old.some(x => x.id === m.msg.id)) return old;
        const next = [...old, m.msg];
        if (atBottom.current || m.msg.sender.id === ctx.me.id) {
          requestAnimationFrame(() => scrollBottom());
          ctx.ws.send({ t: 'read', kind, channel_id: channelId, msg_id: m.msg.id });
        } else setHasNewBelow(true);
        if (m.msg.sender.id !== ctx.me.id && document.hidden) ctx.notify(`${m.msg.sender.display_name}`, m.msg.content.slice(0, 80));
        return next;
      });
    }
    if (m.t === 'msg:update' && `${m.msg.channel_kind}:${m.msg.channel_id}` === room)
      setMessages(old => old.map(x => x.id === m.msg.id ? m.msg : x));
    if (m.t === 'msg:remove') setMessages(old => old.map(x => x.id === m.id ? { ...x, deleted: 1, content: '' } : x));
    if (m.t === 'react:update') setMessages(old => old.map(x => x.id === m.messageId ? { ...x, reactions: m.reactions } : x));
    if (m.t === 'typing' && m.channelId === channelId && m.kind === kind) {
      setTypingUsers(t => ({ ...t, [m.user.id]: Date.now() }));
      setTimeout(() => setTypingUsers(t => { const n = { ...t }; delete n[m.user.id]; return n; }), 4000);
    }
  }), [kind, channelId, messages.length === 0]);

  function scrollBottom() {
    const el = listRef.current; if (el) el.scrollTop = el.scrollHeight;
    setHasNewBelow(false);
  }
  const onScroll = () => {
    const el = listRef.current;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom.current) {
      setHasNewBelow(false);
      const last = messages[messages.length - 1];
      if (last) ctx.ws.send({ t: 'read', kind, channel_id: channelId, msg_id: last.id });
    }
    if (el.scrollTop < 80 && messages[0] && !loadingMore.current) {
      loadingMore.current = true;
      load(messages[0].id).finally(() => { loadingMore.current = false; });
    }
  };
  const loadingMore = useRef(false);

  const send = () => {
    if (!input.trim() && !attach) return;
    ctx.ws.send({ t: 'msg:send', kind, channel_id: channelId, content: input, reply_to: replyTo?.id || null, attachment: attach || undefined });
    setInput(''); setAttach(null); ctx.setReplyTo(null); setMentionPopup(null);
    requestAnimationFrame(() => scrollBottom());
    autoResize();
  };
  const typingThrottle = useRef(0);
  const onInput = e => {
    setInput(e.target.value); autoResize();
    const now = Date.now();
    if (now - typingThrottle.current > 2000) { typingThrottle.current = now; ctx.ws.send({ t: 'typing', kind, channel_id: channelId }); }
    // @-Mentions-Autocomplete
    const word = /(?:^|\s)@([\w.-]*)$/.exec(e.target.value);
    if (word && kind === 'guild') {
      const q = word[1].toLowerCase();
      const hits = (ctx.guild?.members || []).filter(m => m.username.startsWith(q) || m.display_name.toLowerCase().startsWith(q)).slice(0, 8);
      setMentionPopup(hits.length ? { hits, replaceFrom: e.target.value.length - word[1].length - 1 } : null);
    } else setMentionPopup(null);
  };
  const autoResize = () => { const ta = taRef.current; if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; } };

  const pickFile = async file => {
    if (!file) return;
    if (!/image\//.test(file.type)) return ctx.toast('Nur Bilder als Anhang (max 5 MB)');
    if (file.size > 5 * 1024 * 1024) return ctx.toast('Datei zu groß (max 5 MB)');
    const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    const att = await api('/upload', { body: { data: dataUrl, name: file.name, mime: file.type, kind: 'attachment' } });
    setAttach(att);
  };

  useEffect(() => {
    if (jumpTarget) {
      const el = listRef.current?.querySelector(`[data-mid="${jumpTarget}"]`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.style.background = 'rgba(88,101,242,.15)'; setTimeout(() => el.style.background = '', 1600); }
      setJumpTarget(null);
    }
  }, [jumpTarget, messages.length]);
  useEffect(() => { ctx.setJumpHandler(() => setJumpTarget); return () => ctx.setJumpHandler(null); }, []);

  // Suche
  useEffect(() => {
    if (searchQ.length < 2 || kind !== 'guild') { setResults(null); return; }
    const t = setTimeout(async () => { const { results } = await api(`/search?q=${encodeURIComponent(searchQ)}&guild_id=${ctx.guild.id}`); setResults(results); }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const usernames = useMemo(() => {
    const map = new Map();
    for (const m of ctx.guild?.members || []) map.set(m.username, m.user_id);
    return map;
  }, [ctx.guild]);

  const title = kind === 'dm'
    ? (dm?.is_group ? `👥 ${dm.name}` : `@ ${(dm?.participants || []).find(p => p.id !== ctx.me.id)?.display_name || '…'}`)
    : `# ${channel?.name || '…'}`;

  const typers = Object.keys(typingUsers);
  let lastGroup = null;

  return (
    <div className="main">
      <div className="chat-header">
        <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
        {kind === 'guild' && channel?.topic && <span className="topic">{channel.topic}</span>}
        <div className="hdr-btns">
          {kind === 'guild' && <input className="searchbox" placeholder="Suchen" value={searchQ} onChange={e => setSearchQ(e.target.value)} />}
          {kind === 'guild' && (ctx.perms & 4) !== 0 && (
            <button className="hdr-btn" title="Kanal bearbeiten" onClick={() => ctx.editChannel(channel)}>✏️</button>
          )}
          {ctx.toggleMembers && <button className={`hdr-btn ${ctx.membersOpen ? 'on' : ''}`} title="Mitglieder" onClick={ctx.toggleMembers}>👥</button>}
        </div>
      </div>

      <div className="msgs" ref={listRef} onScroll={onScroll} style={{ position: 'relative' }}>
        {results ? (
          <div style={{ padding: '8px 16px' }}>
            <div className="section-title">{results.length} Treffer für „{searchQ}“</div>
            {results.map(r => (
              <div key={r.id} className="friend-row" onClick={() => { setResults(null); setSearchQ(''); ctx.jumpTo(r.id); }}>
                <Avatar user={r.sender} size="sm" />
                <div style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{r.sender.display_name}</b>
                  <div style={{ fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content}</div></div>
                <span className="msg-time" style={{ marginLeft: 'auto' }}>{fmtTime(r.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {hasNewBelow && <div className="jump-bar" onClick={scrollBottom}>Neue Nachrichten ↓</div>}
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const grouped = !!prev && !msg.system && !prev.system && prev.sender.id === msg.sender.id && msg.created_at - prev.created_at < 600000 && !msg.reply_to && !prev.pinned;
              const unreadDivider = !grouped && i > 0 && ctx.readOf(kind, channelId) >= prev.id && ctx.readOf(kind, channelId) < msg.id && msg.sender.id !== ctx.me.id;
              return (
                <React.Fragment key={msg.id}>
                  {unreadDivider && <div className="divider-unread">Neu</div>}
                  {msg.system ? <Message msg={msg} ctx={ctx} grouped={grouped} usernames={usernames} />
                    : <Message msg={msg} ctx={ctx} grouped={grouped} usernames={usernames} />}
                </React.Fragment>
              );
            })}
            {messages.length === 0 && <div style={{ margin: 'auto', color: 'var(--faint)', textAlign: 'center', paddingBottom: 60 }}>Noch keine Nachrichten.<br />Schreib den ersten Satz! ✍️</div>}
          </>
        )}
      </div>

      <div className="typing-bar">
        {typers.length > 0 && <>
          <span className="dots"><span /><span /><span /></span>
          <b>{typers.map(id => ctx.userName(id)).slice(0, 3).join(', ')}</b>
          <span>{typers.length === 1 ? 'schreibt…' : 'schreiben…'}</span>
        </>}
      </div>

      <div className="composer" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickFile(e.dataTransfer.files[0]); }}>
        {replyTo && (
          <div className="reply-strip">
            Antwort an <b style={{ color: replyTo.sender?.display_name ? undefined : undefined }}>{replyTo.sender.display_name}</b>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.content}</span>
            <button onClick={() => ctx.setReplyTo(null)}>✕</button>
          </div>
        )}
        {attach && (
          <div className="attach-preview">
            <img src={attach.url} alt="" /><span style={{ alignSelf: 'center', fontSize: 13 }}>{attach.name}</span>
            <button style={{ marginLeft: 'auto', alignSelf: 'center' }} onClick={() => setAttach(null)}>✕ entfernen</button>
          </div>
        )}
        <div className="input-wrap">
          <label className="icon-btn" title="Bild anhängen">➕
            <input type="file" accept="image/*" hidden onChange={e => pickFile(e.target.files[0])} />
          </label>
          <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
            {mentionPopup && (
              <div className="menu" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8 }}>
                {mentionPopup.hits.map(m => (
                  <button key={m.user_id} onMouseDown={() => {
                    setInput(input.slice(0, mentionPopup.replaceFrom) + '@' + m.username + ' ');
                    setMentionPopup(null); taRef.current?.focus();
                  }}>@{m.username} — {m.display_name}</button>
                ))}
              </div>
            )}
            <textarea ref={taRef} rows={1} placeholder={kind === 'dm' ? 'Nachricht schreiben…' : `Nachricht an #${channel?.name || ''} schreiben…`}
              value={input} onChange={onInput}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } if (e.key === 'Escape') { ctx.setReplyTo(null); setMentionPopup(null); } }} />
          </div>
          <button className="icon-btn" title="Emoji (:shortcode:)" onClick={() => setShowEmoji(s => !s)}>😀</button>
          <button className="send-btn" disabled={!input.trim() && !attach} onClick={send}>➤</button>
        </div>
      </div>
      {showEmoji && <EmojiPicker onClose={() => setShowEmoji(false)} onPick={em => { setInput(i => i + em); taRef.current?.focus(); }} />}
    </div>
  );
}

function EmojiPicker({ onPick, onClose }) {
  const cats = {
    'Smileys': '😀 😁 😂 🤣 😊 😉 😍 😘 😎 🤔 😴 😢 😡 😱 🥳 🤯 🥺 😇 🤖 👻 💀 🫠'.split(' '),
    'Gesten': '👍 👎 👌 🤝 ✌️ 🤞 👏 🙏 💪 🫶 👋 🤙 ☝️ 👇 🙌 🫰 🤟 🖐️'.split(' '),
    'Herzen': '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💘 💝 💔'.split(' '),
    'Tiere': '🐶 🐱 🦊 🐻 🐼 🐨 🦁 🐸 🐵 🐔 🐧 🦄 🐝 🦋 🐙 🦈 🐬 🐳 🦖 🌵 🌸 🍀'.split(' '),
    'Essen': '🍕 🍔 🍟 🌭 🍿 🧂 🍩 🍰 🎂 🍦 ☕ 🍺 🍷 🥤 🍇 🍉 🍓 🥑 🌽 🥖'.split(' '),
    'Aktivität': '⚽ 🏀 🎮 🎲 🎯 🎨 🎵 🎸 🏆 🥇 🎃 🎄 🎁 🎉 🎊 🕹️ 🧩 🚀 ✨ 🔥 ⭐ 🌈'.split(' '),
  };
  useEffect(() => { const h = e => { if (!e.target.closest('.emoji-pop')) onClose(); }; setTimeout(() => document.addEventListener('mousedown', h), 50); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div className="emoji-pop">
      <div style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13 }}>Emojis</div>
      <div className="emoji-grid" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
        {Object.values(cats).flat().map((em, i) => <button key={i} className="emoji-cell" onClick={() => onPick(em)}>{em}</button>)}
      </div>
      <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--muted)' }}>Tipp: Shortcodes wie <code>:joy:</code> funktionieren auch im Text</div>
    </div>
  );
}
