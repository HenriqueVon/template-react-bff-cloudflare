import { describe, expect, it } from 'vitest';
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, idleStatus, secondsUntilIdle } from './idle';

const LAST_ACTIVITY = 1_000_000;

describe('idleStatus', () => {
  it('should stay active until the last minute', () => {
    expect(idleStatus(LAST_ACTIVITY, LAST_ACTIVITY)).toBe('active');
    expect(idleStatus(LAST_ACTIVITY, LAST_ACTIVITY + IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1)).toBe('active');
  });

  it('should warn during the last minute', () => {
    expect(idleStatus(LAST_ACTIVITY, LAST_ACTIVITY + IDLE_TIMEOUT_MS - IDLE_WARNING_MS)).toBe('warning');
    expect(idleStatus(LAST_ACTIVITY, LAST_ACTIVITY + IDLE_TIMEOUT_MS - 1)).toBe('warning');
  });

  it('should be idle once the timeout has passed, also long after it', () => {
    expect(idleStatus(LAST_ACTIVITY, LAST_ACTIVITY + IDLE_TIMEOUT_MS)).toBe('idle');
    expect(idleStatus(LAST_ACTIVITY, LAST_ACTIVITY + 3 * 24 * 60 * 60_000)).toBe('idle');
  });

  it('should use a timeout of 30 minutes and a warning of 1 minute (M-010)', () => {
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60_000);
    expect(IDLE_WARNING_MS).toBe(60_000);
  });
});

describe('secondsUntilIdle', () => {
  it('should count the whole seconds left, never below zero', () => {
    expect(secondsUntilIdle(LAST_ACTIVITY, LAST_ACTIVITY + IDLE_TIMEOUT_MS - IDLE_WARNING_MS)).toBe(60);
    expect(secondsUntilIdle(LAST_ACTIVITY, LAST_ACTIVITY + IDLE_TIMEOUT_MS - 500)).toBe(1);
    expect(secondsUntilIdle(LAST_ACTIVITY, LAST_ACTIVITY + IDLE_TIMEOUT_MS + 5_000)).toBe(0);
  });
});
