import React from 'react';

export function Avatar({ user, size = '', status, showStatus = false, onClick }) {
  const initial = (user?.display_name || user?.username || '?')[0].toUpperCase();
  const bg = user?.accent_color || '#5865f2';
  return (
    <span className="av-wrap" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <span className={`av ${size}`} style={{ background: bg }}>
        {user?.avatar_path ? <img src={user.avatar_path} alt="" /> : initial}
      </span>
      {showStatus && <span className={`status-dot ${user?.status || 'offline'}`} />}
    </span>
  );
}

const EMOJI_SHORT = { smile:'😀', grin:'😁', joy:'😂', wink:'😉', blush:'😊', heart:'❤️', fire:'🔥', thumbsup:'👍', '+1':'👍', thumbsdown:'👎', eyes:'👀', tada:'🎉', wave:'👋', thinking:'🤔', cry:'😢', rage:'😡', cool:'😎', star:'⭐', check:'✅', x:'❌', zap:'⚡', bug:'🐛', rocket:'🚀', pizza:'🍕', beer:'🍺', skull:'💀', ghost:'👻', alien:'👽', cat:'😺', dog:'🐶', love:'😍', kiss:'😘', confused:'😕', sleepy:'😴', scream:'😱', shrug:'🤷', clap:'👏', muscle:'💪', pray:'🙏', ok:'👌', punch:'👊', raised_hands:'🙌', point_up:'☝️', 100:'💯', bell:'🔔', lock:'🔒', key:'🔑', mail:'📧', calendar:'📅', memo:'📝', book:'📚', music:'🎵', gamepad:'🎮', trophy:'🏆', medal:'🏅', dart:'🎯', dice:'🎲', crown:'👑', gem:'💎', money:'💰', coffee:'☕', cake:'🍰', burger:'🍔', apple:'🍎', cherry:'🍒', sun:'☀️', moon:'🌙', cloud:'☁️', rain:'🌧️', snow:'❄️', rainbow:'🌈', plant:'🌱', flower:'🌸', tree:'🌳', leaf:'🍃', snake:'🐍', turtle:'🐢', whale:'🐋', dolphin:'🐬', bird:'🐦', fox:'🦊', bear:'🐻', panda:'🐼', lion:'🦁', unicorn:'🦄', dragon:'🐉', spider:'🕷️', butterfly:'🦋', shark:'🦈', octopus:'🐙', crab:'🦀', snail:'🐌', pig:'🐷', cow:'🐮', chicken:'🐔', penguin:'🐧', frog:'🐸', monkey:'🐵', robot:'🤖', 'jack-o-lantern':'🎃', christmas_tree:'🎄', gift:'🎁', balloon:'🎈', confetti_ball:'🎊', sparkles:'✨', zzz:'💤', anger:'💢', sweat_smile:'😅', relieved:'😌', stuck_out_tongue:'😛', heart_eyes:'😍', sunglasses:'😎', party_face:'🥳', handshake:'🤝', peace:'☮️', skull_cross:'☠️', hourglass:'⌛', watch:'⌚', computer:'💻', phone:'📱', tv:'📺', camera:'📷', bulb:'💡', magnet:'🧲', flask:'⚗️', microscope:'🔬', pill:'💊', syringe:'💉', dna:'🧬', brain:'🧠', bone:'🦴', tooth:'🦷', eye:'👁️', tongue:'👅', ear:'👂', nose:'👃', footprints:'👣', ring:'💍', lipstick:'💄', briefcase:'💼', school:'🏫', house:'🏠', hospital:'🏥', bank:'🏦', hotel:'🏨', church:'⛪', castle:'🏰', stadium:'🏟️', ferris_wheel:'🎡', rocket_launch:'🚀', airplane:'✈️', car:'🚗', bus:'🚌', bike:'🚲', train:'🚂', ship:'🚢', anchor:'⚓', map:'🗺️', island:'🏝️', volcano:'🌋', desert:'🏜️', mountain:'⛰️', campsite:'🏕️', beach:'🏖️', construction:'🏗️', fuse:'🧨', wrench:'🔧', hammer:'🔨', gear:'⚙️', nut_bolt:'🔩', shield:'🛡️', sword:'⚔️', bow_arrow:'🏹', magic_wand:'🪄', crystal_ball:'🔮', joystick:'🕹️', puzzle:'🧩', art:'🎨', thread:'🧵', yarn:'🧶', coat:'🧥', glasses:'👓', hat:'🎩', cap:'🧢', boots:'🥾', sneaker:'👟', handbag:'👜', luggage:'🧳', wallet:'👛', purse:'👝' };

export function renderContent(content, meId, usernames) {
  // returns array of React nodes; supports **bold** *italic* `code` ```block``` links @mentions emoji-shortcodes
  const parts = [];
  let text = String(content ?? '');
  // code blocks first
  const chunks = text.split(/(```[\s\S]*?```)/g);
  for (const c of chunks) {
    if (c.startsWith('```') && c.endsWith('```')) {
      parts.push(<pre key={parts.length}>{c.slice(3, -3).replace(/^\n/, '').replace(/\n$/, '')}</pre>);
      continue;
    }
    parts.push(...renderInline(c, parts.length + ':', meId, usernames));
  }
  return parts;
}

function renderInline(text, keyBase, meId, usernames) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|https?:\/\/\S+|:[a-z0-9_+-]+:|@[\w.@-]+)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = keyBase + ':' + m.index;
    if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*')) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else if (tok.startsWith('`')) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('http')) out.push(<a key={k} href={tok} target="_blank" rel="noreferrer">{tok}</a>);
    else if (tok.startsWith(':')) out.push(EMOJI_SHORT[tok.slice(1, -1)] || tok);
    else if (tok.startsWith('@')) {
      const name = tok.slice(1).replace(/[.,;:!?]$/, '');
      const isEveryone = name === 'everyone' || name === 'here';
      const uidHit = usernames && usernames.get(name.toLowerCase());
      const isMe = isEveryone || (uidHit && uidHit === meId);
      out.push(<span key={k} className={`mention ${isMe ? 'me' : ''}`}>@{name}</span>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  const today = new Date();
  const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Heute um ${hm}`;
  const yst = new Date(today - 864e5);
  if (d.toDateString() === yst.toDateString()) return `Gestern um ${hm}`;
  return `${d.toLocaleDateString('de-DE')} ${hm}`;
}

export function Modal({ title, children, onClose, footer, wide }) {
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className="modal" style={wide ? { width: 600 } : null} onMouseDown={e => e.stopPropagation()}>
        {title && <div className="modal-head">{title}</div>}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ text, danger, onYes, onCancel, title }) {
  return (
    <Modal title={title || 'Bist du sicher?'} onClose={onCancel}
      footer={<>
        <button className="btn secondary" style={{ width: 'auto' }} onClick={onCancel}>Abbrechen</button>
        <button className={`btn small ${danger ? 'danger' : ''}`} onClick={onYes}>Ja</button>
      </>}>
      <div style={{ color: 'var(--muted)', padding: '6px 0' }}>{text}</div>
    </Modal>
  );
}

export function Menu({ x, y, items, onClose }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 94 }} onMouseDown={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div className="menu" style={{ position: 'fixed', left: Math.min(x, window.innerWidth - 190), top: Math.min(y, window.innerHeight - items.length * 36 - 20) }}>
        {items.map((it, i) => it.sep ? <hr key={i} /> : (
          <button key={i} className={it.red ? 'red' : ''} onClick={() => { onClose(); it.fn && it.fn(); }}>{it.label}</button>
        ))}
      </div>
    </>
  );
}

export const ACCENTS = ['#5865f2','#eb459e','#f23f43','#f0b232','#23a55a','#1abc9c','#00a8fc','#9b59b6','#e67e22','#95a5a6','#f9a8d4','#a3e635'];

export function bannerStyle(user) {
  if (user?.banner_path) return { backgroundImage: `url(${user.banner_path})` };
  if (user?.banner_css) return { background: user.banner_css };
  const a = user?.accent_color || '#5865f2';
  return { background: `linear-gradient(120deg, ${a}, #1e1f22 85%)` };
}
