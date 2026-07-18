const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface HostState {
  active: number;
  nextAt: number;
}

export interface HostLimiterOptions {
  minIntervalMs?: number;
  maxConcurrent?: number;
}

/**
 * Per-host politeness limiter shared by every worker in the process:
 * at most `maxConcurrent` in-flight requests per host, with request
 * starts spaced at least `minIntervalMs` apart.
 */
export class HostLimiter {
  private readonly minIntervalMs: number;
  private readonly maxConcurrent: number;
  private readonly hosts = new Map<string, HostState>();

  constructor(options: HostLimiterOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.maxConcurrent = options.maxConcurrent ?? 2;
  }

  async acquire(host: string, signal?: AbortSignal): Promise<() => void> {
    const key = host.toLowerCase();
    let state = this.hosts.get(key);
    if (!state) {
      state = { active: 0, nextAt: 0 };
      this.hosts.set(key, state);
    }
    for (;;) {
      signal?.throwIfAborted();
      const now = Date.now();
      if (state.active < this.maxConcurrent && now >= state.nextAt) {
        state.active++;
        state.nextAt = now + this.minIntervalMs;
        let released = false;
        return () => {
          if (released) return;
          released = true;
          state.active--;
        };
      }
      await sleep(Math.min(50, Math.max(10, state.nextAt - now)));
    }
  }
}
