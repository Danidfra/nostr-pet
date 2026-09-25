/**
 * A recording AudioContext for the voice tests: every node created, every
 * scheduled value, every start/stop, and whether resume was asked for.
 * Nothing makes a sound; the graph is what is under test.
 */
export interface FakeParam {
  events: Array<[string, number, number]>;
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime: (v: number, t: number) => void;
  exponentialRampToValueAtTime: (v: number, t: number) => void;
}
function param(): FakeParam {
  const p: FakeParam = {
    events: [],
    setValueAtTime: (v, t) => void p.events.push(['set', v, t]),
    linearRampToValueAtTime: (v, t) => void p.events.push(['lin', v, t]),
    exponentialRampToValueAtTime: (v, t) => void p.events.push(['exp', v, t]),
  };
  return p;
}
export interface FakeNode {
  kind: 'osc' | 'gain' | 'filter' | 'delay';
  type?: string;
  frequency?: FakeParam;
  gain?: FakeParam;
  Q?: FakeParam;
  delayTime?: FakeParam;
  connections: FakeNode[];
  started?: number;
  stopped?: number;
  onended?: (() => void) | null;
  disconnected: boolean;
  connect: (to: FakeNode) => void;
  disconnect: () => void;
  start?: (t: number) => void;
  stop?: (t: number) => void;
}
function node(kind: FakeNode['kind']): FakeNode {
  const n: FakeNode = {
    kind,
    connections: [],
    disconnected: false,
    connect: (to) => void n.connections.push(to),
    disconnect: () => void (n.disconnected = true),
  };
  if (kind === 'osc') {
    n.frequency = param();
    n.type = 'sine';
    n.start = (t) => void (n.started = t);
    n.stop = (t) => void (n.stopped = t);
    n.onended = null;
  }
  if (kind === 'gain') n.gain = param();
  if (kind === 'filter') {
    n.frequency = param();
    n.Q = param();
  }
  if (kind === 'delay') n.delayTime = param();
  return n;
}
export interface FakeAudioContext {
  state: 'suspended' | 'running';
  currentTime: number;
  destination: FakeNode;
  nodes: FakeNode[];
  resumes: number;
  resume: () => Promise<void>;
  createOscillator: () => FakeNode;
  createGain: () => FakeNode;
  createBiquadFilter: () => FakeNode;
  createDelay: () => FakeNode;
}
export function fakeAudioContext(state: 'suspended' | 'running' = 'running'): FakeAudioContext {
  const ctx: FakeAudioContext = {
    state,
    currentTime: 10,
    destination: node('gain'),
    nodes: [],
    resumes: 0,
    resume: async () => {
      ctx.resumes += 1;
      ctx.state = 'running';
    },
    createOscillator: () => {
      const n = node('osc');
      ctx.nodes.push(n);
      return n;
    },
    createGain: () => {
      const n = node('gain');
      ctx.nodes.push(n);
      return n;
    },
    createBiquadFilter: () => {
      const n = node('filter');
      ctx.nodes.push(n);
      return n;
    },
    createDelay: () => {
      const n = node('delay');
      ctx.nodes.push(n);
      return n;
    },
  };
  return ctx;
}
