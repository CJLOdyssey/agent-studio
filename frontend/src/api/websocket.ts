export type WsCallback = (data: Record<string, unknown>) => void;

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

let maxRetries = 3;

interface ConnState {
  ws: WebSocket;
  listeners: Set<WsCallback>;
  runId: string;
  reconnectCount: number;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

const connections = new Map<string, ConnState>();

export function setMaxRetries(n: number): void {
  maxRetries = n;
}

function connect(runId: string): ConnState {
  const ws = new WebSocket(`${WS_BASE}/runs/${runId}`);
  const listeners = new Set<WsCallback>();
  const state: ConnState = { ws, listeners, runId, reconnectCount: 0 };
  connections.set(runId, state);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      state.listeners.forEach((cb) => cb(data));
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    if (state.listeners.size > 0 && state.reconnectCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, state.reconnectCount), 10000);
      state.reconnectCount++;
      console.warn(
        `[ws] run ${runId} disconnected, reconnecting (${state.reconnectCount}/${maxRetries}) in ${delay}ms...`
      );
      state.reconnectTimer = setTimeout(() => {
        if (state.listeners.size > 0) {
          const newWs = new WebSocket(`${WS_BASE}/runs/${runId}`);
          newWs.onmessage = ws.onmessage;
          newWs.onclose = ws.onclose;
          newWs.onerror = () => newWs.close();
          state.ws = newWs;
          connections.set(runId, state);
        }
      }, delay);
    } else if (state.listeners.size === 0) {
      // intentional close, no reconnect
      connections.delete(runId);
    } else {
      console.warn(`[ws] run ${runId} max retries reached, giving up`);
      connections.delete(runId);
    }
  };

  ws.onerror = () => {
    ws.close();
  };

  return state;
}

export function connectRun(runId: string, onMessage: WsCallback): () => void {
  const existing = connections.get(runId);
  if (existing) {
    existing.listeners.add(onMessage);
    return () => { existing.listeners.delete(onMessage); };
  }

  const state = connect(runId);
  state.listeners.add(onMessage);

  return () => {
    state.listeners.delete(onMessage);
    if (state.listeners.size === 0) {
      if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
      state.ws.close();
      connections.delete(runId);
    }
  };
}

export function disconnectRun(runId: string): void {
  const conn = connections.get(runId);
  if (conn) {
    if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
    conn.listeners.clear();
    conn.ws.close();
    connections.delete(runId);
  }
}
