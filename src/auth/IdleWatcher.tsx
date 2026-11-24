import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/toast-context';
import { useI18n } from '@/i18n/i18n-context';
import { errorMessage } from '@/lib/errors';
import { readLastActivity, saveLastActivity } from '@/lib/storage';
import { idleStatus, secondsUntilIdle } from './idle';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

// Activity is written at most this often, so moving the mouse does not write on every event.
const ACTIVITY_WRITE_INTERVAL_MS = 15_000;

// Mounted while signed in. Counts the interactions of every tab through the shared last-activity
// time, warns in the last minute and calls onIdle when the time is up.
export function IdleWatcher({ onIdle, onLogout }: { onIdle: () => void; onLogout: () => Promise<void> }) {
  const { t, tx } = useI18n();
  const toast = useToast();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // This tab's own last activity, used when storage is unavailable. Set when the effect starts.
  const ownActivity = useRef(0);
  const warning = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    const markActive = (force = false) => {
      const now = Date.now();
      if (!force && now - ownActivity.current < ACTIVITY_WRITE_INTERVAL_MS) return;
      ownActivity.current = now;
      saveLastActivity(now);
    };

    // While the warning is open, only its buttons keep the session, so a click on "Sign out now" is
    // not undone by the pointerdown that starts it.
    const onActivity = () => {
      if (!warning.current) markActive();
    };

    const check = () => {
      if (ended.current) return;

      const now = Date.now();
      const lastActivity = Math.max(readLastActivity() ?? 0, ownActivity.current);
      const status = idleStatus(lastActivity, now);

      if (status === 'idle') {
        ended.current = true;
        onIdle();
        return;
      }

      warning.current = status === 'warning';
      setSecondsLeft(warning.current ? secondsUntilIdle(lastActivity, now) : null);
    };

    markActive(true);
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true, capture: true });
    }
    // A tab in the background or a computer back from sleep may skip timer ticks.
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, { capture: true });
      }
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [onIdle]);

  if (secondsLeft === null) return null;

  const stay = () => {
    const now = Date.now();
    ownActivity.current = now;
    saveLastActivity(now);
    warning.current = false;
    setSecondsLeft(null);
  };

  // When the logout does not reach the Functions the session is kept: say so, and the countdown goes on, so the
  // screen still closes by itself when the time is up.
  const signOutNow = async () => {
    try {
      await onLogout();
    } catch (failure) {
      toast.show(errorMessage(failure, t), 'error');
    }
  };

  return (
    <Modal title={t('idle.title')} onClose={stay}>
      <div className="space-y-4 text-body-md">
        <p className="text-on-surface-variant">
          {tx('idle.body', { seconds: <strong className="text-on-surface">{t('idle.seconds', { count: secondsLeft })}</strong> })}
        </p>
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="secondary" onClick={() => void signOutNow()}>{t('idle.signOutNow')}</Button>
          <Button onClick={stay}>{t('idle.stay')}</Button>
        </div>
      </div>
    </Modal>
  );
}
