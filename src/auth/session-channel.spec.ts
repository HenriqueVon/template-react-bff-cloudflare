import { describe, expect, it, vi } from 'vitest';
import { openSessionChannel, type LogoutReason } from './session-channel';

describe('session channel', () => {
  it('should tell the other tab why the session ended, and not the tab that sent it', async () => {
    const received: LogoutReason[] = [];
    const sender = vi.fn();
    const receiverTab = openSessionChannel((reason) => received.push(reason));
    const senderTab = openSessionChannel(sender);

    senderTab.postLogout('idle');
    senderTab.postLogout('logout');
    await vi.waitFor(() => expect(received).toEqual(['idle', 'logout']));

    expect(sender).not.toHaveBeenCalled();
    senderTab.close();
    receiverTab.close();
  });

  it('should do nothing, and not fail, when BroadcastChannel does not exist', () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    const channel = openSessionChannel(() => undefined);

    expect(() => channel.postLogout('logout')).not.toThrow();
    expect(() => channel.close()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
