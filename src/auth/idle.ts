// Idle logout: the session ends after 30 minutes without any interaction in any tab of the
// app, with a warning during the last minute.

export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const IDLE_WARNING_MS = 60_000;

export type IdleStatus = 'active' | 'warning' | 'idle';

export function idleStatus(lastActivity: number, now: number): IdleStatus {
  const elapsed = now - lastActivity;
  if (elapsed >= IDLE_TIMEOUT_MS) return 'idle';
  if (elapsed >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS) return 'warning';
  return 'active';
}

export function secondsUntilIdle(lastActivity: number, now: number): number {
  return Math.max(0, Math.ceil((lastActivity + IDLE_TIMEOUT_MS - now) / 1000));
}
