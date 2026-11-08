// Build-time signaling configuration from VITE_* variables (docs/deployment.md §3).
// Pure: the UI passes `import.meta.env`, tests pass plain objects.

export interface TurnConfig {
  readonly url: string;
  readonly username?: string;
  readonly credential?: string;
}

export interface SignalingConfig {
  readonly strategy: 'nostr' | 'ws-relay';
  /** Nostr relays replacing the library defaults; empty means the defaults. */
  readonly relayUrls: readonly string[];
  /** Self-hosted relay, required for `ws-relay`. */
  readonly relayUrl: string | null;
  readonly turn: TurnConfig | null;
}

type Env = Readonly<Record<string, string | undefined>>;

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function signalingConfigFrom(env: Env): SignalingConfig {
  const strategy = env.VITE_SIGNALING === 'ws-relay' ? 'ws-relay' : 'nostr';
  const relayUrl = env.VITE_RELAY_URL?.trim() ?? '';
  if (strategy === 'ws-relay' && relayUrl === '') {
    throw new Error('VITE_SIGNALING=ws-relay needs VITE_RELAY_URL (e.g. wss://relay.example.com).');
  }
  const turnUrl = env.VITE_TURN_URL?.trim() ?? '';
  const turn: TurnConfig | null = turnUrl === ''
    ? null
    : {
        url: turnUrl,
        ...(env.VITE_TURN_USER ? { username: env.VITE_TURN_USER } : {}),
        ...(env.VITE_TURN_CREDENTIAL ? { credential: env.VITE_TURN_CREDENTIAL } : {}),
      };
  return {
    strategy,
    relayUrls: list(env.VITE_RELAY_URLS),
    relayUrl: relayUrl === '' ? null : relayUrl,
    turn,
  };
}
