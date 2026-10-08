import React, { useState, useEffect } from 'react';
import { api } from './api';
import { Avatar, Modal, Confirm, ACCENTS, bannerStyle } from './ui';

/* ---------- Einstellungen (Profil, Profilbild/Banner, Aussehen, Konto) ---------- */
export function Settings({ me, onClose, setMe, toast }) {
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({
    display_name: me.display_name, pronouns: me.pronouns || '', bio: me.bio || '',
    accent_color: me.accent_color || '', status_text: me.status_text || '', banner_css: me.banner_css || '',
  });
  const [theme, setTheme] = useState(me.settings?.theme || 'dark');
  const [sound, setSound] = useState(me.settings?.sound !== false);
  const [notifOn, setNotifOn] = useState(false);
  const [pw, setPw] = useState({ old_password: '', new_password: '' });
  const save = async (patch = {}) => {
    const { user } = await api('/profile', { method: 'PUT', body: { ...form, settings: { theme, sound }, ...patch } });
    setMe(user); toast('Gespeichert ✔');
  };
  const uploadImg = async (file, url) => {
    if (!/image\//.test(file.type)) return toast('Nur Bilddateien');
    if (file.size > 5 * 1024 * 1024) return toast('Max. 5 MB');
    const data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    const att = await api('/upload', { body: { data, name: file.name, mime: file.type, kind: url.slice(1) } });
    const { user } = await api(url, { method: 'PUT', body: { url: att.url } });
    setMe(user); toast('Hochgeladen ✔');
  };
  const BANNERS = [
    ['', 'Standard'], ['linear-gradient(135deg,#5865f2,#eb459e)', 'Blurple-Pink'],
    ['linear-gradient(135deg,#23a55a,#1abc9c)', 'Dschungel'], ['linear-gradient(135deg,#f0b232,#f23f43)', 'Sonnenuntergang'],
    ['linear-gradient(135deg,#00a8fc,#9b59b6)', 'Ozean-Magie'], ['linear-gradient(135deg,#111,#5865f2)', 'Midnight'],
    ['radial-gradient(circle at 30% 30%,#eb459e,#5865f2 60%,#1e1f22)', 'Cosmos'],
    ['repeating-linear-gradient(45deg,#5865f2,#5865f2 20px,#4752c4 20px,#4752c4 40px)', 'Streifen'],
  ];
  return (
    <div className="settings">
      <button className="set-close" onClick={onClose}>✕</button>
      <div className="set-nav">
        <div className="grp">Mein Konto</div>
        <button className={tab === 'profile' ? 'sel' : ''} onClick={() => setTab('profile')}>Profil</button>
        <button className={tab === 'custom' ? 'sel' : ''} onClick={() => setTab('custom')}>Profil anpassen</button>
        <div className="grp">App-Einstellungen</div>
        <button className={tab === 'appearance' ? 'sel' : ''} onClick={() => setTab('appearance')}>Aussehen</button>
        <button className={tab === 'notifs' ? 'sel' : ''} onClick={() => setTab('notifs')}>Benachrichtigungen</button>
        <button className={tab === 'account' ? 'sel' : ''} onClick={() => setTab('account')}>Konto</button>
      </div>
      <div className="set-main">
        {tab === 'profile' && <>
          <h2>Profil</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <Avatar user={me} size="lg" />
            <div>
              <div style={{ fontWeight: 700 }}>{me.display_name}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>@{me.username}</div>
            </div>
          </div>
          <div className="field"><label>Anzeigename</label>
            <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
          <div className="field"><label>Pronomen</label>
            <input placeholder="z.B. er/ihm" value={form.pronouns} onChange={e => setForm({ ...form, pronouns: e.target.value })} /></div>
          <div className="field"><label>Status-Nachricht</label>
            <input placeholder="Was machst du gerade?" value={form.status_text} onChange={e => setForm({ ...form, status_text: e.target.value })} /></div>
          <div className="field"><label>Biografie (max. 190 Zeichen)</label>
            <textarea rows={3} maxLength={190} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></div>
          <button className="btn small" onClick={() => save()}>Speichern</button>
        </>}

        {tab === 'custom' && <>
          <h2>Profil anpassen</h2>
          <div className="pc-section-title">Avatar</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 18px' }}>
            <Avatar user={me} />
            <label className="btn small" style={{ cursor: 'pointer' }}>Avatar hochladen
              <input type="file" accept="image/*" hidden onChange={e => uploadImg(e.target.files[0], '/avatar')} /></label>
            {me.avatar_path && <button className="btn small secondary" onClick={async () => { await api('/avatar', { method: 'PUT', body: { url: '' } }); setMe({ ...me, avatar_path: '' }); }}>Entfernen</button>}
          </div>
          <div className="pc-section-title">Akzentfarbe</div>
          <div className="color-grid" style={{ margin: '8px 0 18px' }}>
            {['', ...ACCENTS].map(c => (
              <button key={c || 'none'} title={c || 'Standard'} className={`color-swatch ${form.accent_color === c ? 'sel' : ''}`}
                style={{ background: c || 'var(--blurple)' }}
                onClick={() => { setForm(f => ({ ...f, accent_color: c })); save({ accent_color: c }); }} />
            ))}
          </div>
          <div className="pc-section-title">Banner-Vorschau</div>
          <div style={{ ...bannerStyle({ ...me, ...form }), height: 130, borderRadius: 8, marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
            {BANNERS.map(([css, name]) => (
              <button key={name} title={name} onClick={() => { setForm(f => ({ ...f, banner_css: css })); save({ banner_css: css }); }}
                style={{ width: 74, height: 40, borderRadius: 6, background: css || 'var(--input)', border: form.banner_css === css ? '2px solid var(--blurple)' : '1px solid var(--border)' }} />
            ))}
          </div>
          <label className="pc-section-title" style={{ display: 'block' }}>Eigener CSS-Hintergrund oder Bild-URL:</label>
          <input placeholder="linear-gradient(...) oder leer" value={form.banner_css}
            onChange={e => setForm({ ...form, banner_css: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && save()} style={{ width: '100%', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="btn small" style={{ cursor: 'pointer' }}>Banner-Bild hochladen
              <input type="file" accept="image/*" hidden onChange={e => uploadImg(e.target.files[0], '/banner')} /></label>
            {me.banner_path && <button className="btn small secondary" onClick={async () => { await api('/banner', { method: 'PUT', body: { url: '' } }); setMe({ ...me, banner_path: '' }); }}>Bild entfernen</button>}
            <button className="btn small" onClick={() => save()}>Speichern</button>
          </div>
        </>}

        {tab === 'appearance' && <>
          <h2>Aussehen</h2>
          <div className="row-between"><div><b>Theme</b><div className="hint">Dark ist der Standard-Look 💜</div></div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['dark', 'light'].map(t => <button key={t} className={`btn small ${theme === t ? '' : 'secondary'}`}
                onClick={() => { setTheme(t); document.documentElement.dataset.theme = t; }}>{t === 'dark' ? '🌙 Dark' : '☀️ Light'}</button>)}
            </div></div>
          <div className="hint" style={{ marginBottom: 16 }}>Mit „Speichern“ wird das Theme fest für dein Konto gespeichert.</div>
          <button className="btn small" onClick={() => save()}>Speichern</button>
        </>}

        {tab === 'notifs' && <>
          <h2>Benachrichtigungen</h2>
          <div className="row-between"><div><b>Ton bei neuer Nachricht</b><div className="hint">Kurzer „Ping“, wenn du im Kanal bist</div></div>
            <div className={`toggle ${sound ? 'on' : ''}`} onClick={() => setSound(s => !s)} /></div>
          <div className="row-between"><div><b>Browser-Benachrichtigungen</b><div className="hint">Push, wenn der Tab im Hintergrund ist</div></div>
            <button className="btn small" onClick={async () => {
              if (!('Notification' in window)) return toast('Browser unterstützt keine Benachrichtigungen');
              const p = await Notification.requestPermission();
              setNotifOn(p === 'granted'); toast(p === 'granted' ? 'Benachrichtigungen aktiv ✔' : 'Keine Erlaubnis erteilt');
            }}>{notifOn ? 'Aktiv ✔' : 'Aktivieren'}</button></div>
          <button className="btn small" onClick={() => save()}>Speichern</button>
        </>}

        {tab === 'account' && <>
          <h2>Konto</h2>
          <div className="field"><label>Altes Passwort</label>
            <input type="password" value={pw.old_password} onChange={e => setPw({ ...pw, old_password: e.target.value })} /></div>
          <div className="field"><label>Neues Passwort (min. 6 Zeichen)</label>
            <input type="password" value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} /></div>
          <button className="btn small" onClick={async () => {
            try { await api('/password', { body: pw }); setPw({ old_password: '', new_password: '' }); toast('Passwort geändert ✔'); }
            catch (e) { toast(e.message); }
          }}>Passwort ändern</button>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />
          <button className="btn danger small" onClick={async () => { await api('/logout', { body: {} }); location.reload(); }}>Abmelden</button>
        </>}
      </div>
    </div>
  );
}

/* ---------- Server-Settings-Modal (Rollen, Kanäle, Einladungen, Moderation) ---------- */
const PERM_LABELS = [['Kicken', 1], ['Bannen', 2], ['Kanäle verwalten', 4], ['Server verwalten', 8], ['Rollen verwalten', 16]];

export function GuildSettings({ guild, ctx, close, toast }) {
  const [tab, setTab] = useState('overview');
  const [bans, setBans] = useState([]);
  const [roleEdit, setRoleEdit] = useState(null);
  const canManage = (guild.perms & 8) !== 0;
  const canRoles = (guild.perms & 16) !== 0;
  useEffect(() => { if (tab === 'moderation' && canManage) api(`/guilds/${guild.id}/bans`).then(d => setBans(d.bans)).catch(() => {}); }, [tab]);
  const upd = async (body) => { await api(`/guilds/${guild.id}`, { method: 'PUT', body }); ctx.reloadGuilds(); toast('Server aktualisiert ✔'); };
  return (
    <Modal wide title={`⚙ ${guild.name}`} onClose={close} footer={<button className="btn small secondary" onClick={close}>Fertig</button>}>
      <div className="tabs">
        {[['overview', 'Übersicht'], ['channels', 'Kanäle'], ['roles', 'Rollen'], ['widget', 'Einladung'], ...(canManage ? [['moderation', 'Moderation']] : []), ...(ctx.guild.owner_id === ctx.me.id ? [['danger', 'Gefährlich']] : [])]
          .map(([id, label]) => <span key={id} className={`tab ${tab === id ? 'sel' : ''}`} onClick={() => setTab(id)}>{label}</span>)}
      </div>
      {tab === 'overview' && <>
        <div className="field"><label>Servername</label>
          <input defaultValue={guild.name} onBlur={e => e.target.value !== guild.name && upd({ name: e.target.value })} /></div>
        <div className="field"><label>Icon-Emoji</label>
          <input defaultValue={guild.icon_emoji} maxLength={4} onBlur={e => upd({ icon_emoji: e.target.value })} /></div>
        <div className="field"><label>Icon-Farbe</label>
          <div className="color-grid">{ACCENTS.map(c => <button key={c} className={`color-swatch ${guild.icon_color === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => upd({ icon_color: c })} />)}</div></div>
        <div className="row-between"><div><b>Registrierung offen</b><div className="hint">Neue Nutzer dürfen mit dem Invite-Code beitreten</div></div>
          <div className={`toggle ${guild.registration_open ? 'on' : ''}`} onClick={() => upd({ registration_open: guild.registration_open ? 0 : 1 })} /></div>
      </>}
      {tab === 'channels' && <>
        {(ctx.categories || []).map(cat => (
          <div key={cat.id}>
            <div className="pc-section-title">{cat.name}</div>
            {(ctx.channels || []).filter(c => c.category_id === cat.id).map(c => (
              <div key={c.id} className="friend-row" onContextMenu={e => { e.preventDefault(); ctx.deleteChannel(c); }}>
                <span>#</span><span style={{ flex: 1 }}>{c.name}</span>
                <button className="btn small secondary" onClick={() => ctx.editChannel(c)}>Bearbeiten</button>
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn small" onClick={() => ctx.createChannelPrompt(null)}>+ Kanal</button>
          <button className="btn small secondary" onClick={() => ctx.createCategoryPrompt()}>+ Kategorie</button>
        </div>
      </>}
      {tab === 'roles' && <>
        {canRoles && <button className="btn small" style={{ marginBottom: 10 }} onClick={() => setRoleEdit({ id: 0, name: '', color: '#5865f2', perms: 0, hoist: 0 })}>+ Neue Rolle</button>}
        {(ctx.roles || []).filter(r => !r.managed).map(r => (
          <div key={r.id} className="friend-row">
            <span className="role-dot" style={{ background: r.color || 'var(--muted)' }} />
            <span style={{ flex: 1, color: r.color || undefined }}>{r.name}{r.hoist ? ' (angezeigt)' : ''}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{PERM_LABELS.filter(([, b]) => r.perms & b).map(([l]) => l).join(', ') || 'keine'}</span>
            {canRoles && <button className="btn small secondary" onClick={() => setRoleEdit(r)}>Bearbeiten</button>}
            {canRoles && <button className="btn small danger" onClick={() => ctx.deleteRole(r.id)}>Löschen</button>}
          </div>
        ))}
        <div className="pc-section-title">Mitglieder & Rollen</div>
        {(ctx.members || []).map(m => (
          <div key={m.user_id} className="friend-row" style={{ padding: '6px 10px' }}>
            <Avatar user={m} size="sm" />
            <span style={{ flex: 1, fontSize: 14 }}>{m.display_name}</span>
            {canRoles && (ctx.roles || []).filter(r => !r.managed).map(r => (
              <button key={r.id} className="role-tag" style={{ opacity: m.role_ids.includes(r.id) ? 1 : .35, borderColor: r.color || undefined }}
                onClick={() => {
                  const ids = m.role_ids.includes(r.id) ? m.role_ids.filter(x => x !== r.id) : [...m.role_ids, r.id];
                  api(`/guilds/${guild.id}/members/${m.user_id}/roles`, { method: 'PUT', body: { role_ids: ids } }).then(() => ctx.reloadGuild(guild.id));
                }}>{r.name}</button>
            ))}
          </div>
        ))}
      </>}
      {tab === 'widget' && <>
        <div className="hint">Teile diesen Code — Beitreten über „Server beitreten“:</div>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <input readOnly value={guild.invite_code} style={{ flex: 1, fontFamily: 'monospace', fontSize: 18, textAlign: 'center', letterSpacing: 2 }}
            onFocus={e => e.target.select()} />
          <button className="btn small" onClick={() => { navigator.clipboard?.writeText(guild.invite_code); toast('Copiert 📋'); }}>Kopieren</button>
        </div>
        {canManage && <button className="btn small danger" onClick={async () => { const d = await api(`/guilds/${guild.id}/invite/regen`, { body: {} }); toast(`Neuer Code: ${d.invite_code}`); ctx.reloadGuild(guild.id); }}>Invite-Code neu generieren</button>}
      </>}
      {tab === 'moderation' && <>
        <div className="pc-section-title">Gebannte Mitglieder</div>
        {bans.length === 0 && <div className="hint">Niemand gebannt 🎉</div>}
        {bans.map(b => (
          <div key={b.id} className="friend-row"><Avatar user={b} size="sm" /><span style={{ flex: 1 }}>{b.display_name}</span>
            <button className="btn small" onClick={async () => { await api(`/guilds/${guild.id}/bans/${b.id}`, { method: 'DELETE' }); setBans(bs => bs.filter(x => x.id !== b.id)); toast('Entbannt'); }}>Entbannen</button></div>
        ))}
      </>}
      {tab === 'danger' && <>
        <div className="pc-section-title" style={{ color: 'var(--red)' }}>Gefährliche Aktionen</div>
        <p className="hint" style={{ marginBottom: 12 }}>Dies löscht den Server inkl. aller Kanäle und Nachrichten unwiderruflich.</p>
        <button className="btn danger small" onClick={() => ctx.confirmDeleteGuild()}>Server löschen</button>
      </>}
      {roleEdit && (
        <Modal title={roleEdit.id ? `Rolle „${roleEdit.name}“` : 'Neue Rolle'} onClose={() => setRoleEdit(null)} footer={<>
          <button className="btn small secondary" onClick={() => setRoleEdit(null)}>Abbrechen</button>
          <button className="btn small" onClick={async () => {
            const body = { name: roleEdit.name, color: roleEdit.color, perms: roleEdit.perms, hoist: roleEdit.hoist ? 1 : 0 };
            if (roleEdit.id) await api(`/roles/${roleEdit.id}`, { method: 'PUT', body });
            else await api(`/guilds/${guild.id}/roles`, { body });
            setRoleEdit(null); ctx.reloadGuild(guild.id); toast('Rolle gespeichert ✔');
          }}>Speichern</button></>}>
          <div className="field"><label>Name</label><input value={roleEdit.name} onChange={e => setRoleEdit({ ...roleEdit, name: e.target.value })} /></div>
          <div className="field"><label>Farbe</label><div className="color-grid">{ACCENTS.map(c =>
            <button key={c} className={`color-swatch ${roleEdit.color === c ? 'sel' : ''}`} style={{ background: c }} onClick={() => setRoleEdit({ ...roleEdit, color: c })} />)}</div></div>
          <div className="field"><label>Berechtigungen</label>
            {PERM_LABELS.map(([label, bit]) => (
              <div key={label} className="row-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{label}</span>
                <div className={`toggle ${(roleEdit.perms & bit) ? 'on' : ''}`}
                  onClick={() => setRoleEdit({ ...roleEdit, perms: (roleEdit.perms & bit) ? roleEdit.perms & ~bit : roleEdit.perms | bit })} />
              </div>))}</div>
          <div className="row-between"><span style={{ fontSize: 14 }}>In Mitgliederliste hervorheben</span>
            <div className={`toggle ${roleEdit.hoist ? 'on' : ''}`} onClick={() => setRoleEdit({ ...roleEdit, hoist: !roleEdit.hoist })} /></div>
        </Modal>
      )}
    </Modal>
  );
}
