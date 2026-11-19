type Level = 'info' | 'warn' | 'error';

const REDACT = /(api[_-]?key|token|secret|password|authorization|cookie)/i;

function scrub(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = REDACT.test(k) ? '[redacted]' : v;
  }
  return out;
}

function emit(level: Level, msg: string, meta: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...scrub(meta),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
