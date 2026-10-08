// REST-Client + WebSocket-Manager
export async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

export class WS {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.handlers = [];
    this.queue = [];
    this.open();
  }
  open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.sock = new WebSocket(`${proto}://${location.host}/ws`);
    this.sock.onopen = () => { this.queue.forEach(m => this.sock.send(JSON.stringify(m))); this.queue = []; };
    this.sock.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      this.handlers.forEach(h => h(m));
    };
    this.sock.onclose = () => setTimeout(() => this.open(), 1500);
    this.sock.onerror = () => { try { this.sock.close(); } catch {} };
  }
  send(msg) {
    if (this.sock && this.sock.readyState === 1) this.sock.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }
  on(fn) { this.handlers.push(fn); return () => { this.handlers = this.handlers.filter(h => h !== fn); }; }
}

export const uid = () => Math.random().toString(36).slice(2, 10);
