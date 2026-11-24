// Tells the other tabs of the app that the session ended, so they go to the login at once instead of
// on their next call. The cookies are shared, so one logout ends the session of every tab.

export type LogoutReason = 'logout' | 'idle';

type SessionMessage = { type: 'logout'; reason: LogoutReason };

const CHANNEL_NAME = 'my-web-app-session';

export type SessionChannel = {
  postLogout : (reason: LogoutReason) => void;
  close      : () => void;
};

// A message is never delivered to the tab that sent it. Without BroadcastChannel the other tabs find
// out on their next call.
export function openSessionChannel(onLogout: (reason: LogoutReason) => void): SessionChannel {
  if (typeof BroadcastChannel === 'undefined') {
    return { postLogout: () => undefined, close: () => undefined };
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<SessionMessage>) => {
    if (event.data?.type === 'logout') {
      onLogout(event.data.reason === 'idle' ? 'idle' : 'logout');
    }
  };

  return {
    postLogout : (reason) => channel.postMessage({ type: 'logout', reason } satisfies SessionMessage),
    close      : () => channel.close(),
  };
}
