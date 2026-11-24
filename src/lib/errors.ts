import { ApiError } from '@/api/client';
import type { Translate } from '@/i18n/i18n-context';
import { ERROR_CODES } from '@/i18n/messages/errors';

type ErrorCode = typeof ERROR_CODES[number];

function isKnownCode(code: string | undefined): code is ErrorCode {
  return code !== undefined && (ERROR_CODES as readonly string[]).includes(code);
}

function formatWait(seconds: number, t: Translate): string {
  if (seconds < 60) return t('error.seconds', { count: seconds });

  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? t('error.minute') : t('error.minutes', { count: minutes });
}

// A 409 has a different cause in each operation (a unique value on create and update, a record in use on delete), and
// the API may answer both with the same code. The screen knows which one it is, and passes its sentence already
// translated.
export function saveErrorMessage(error: unknown, t: Translate, conflict: string): string {
  if (error instanceof ApiError && error.status === 409) return conflict;

  return errorMessage(error, t);
}

// The message shown for an error, by its code. The raw message of the server is never shown.
export function errorMessage(error: unknown, t: Translate): string {
  if (!(error instanceof ApiError)) {
    return t('error.generic');
  }

  if (error.status === 429) {
    return error.retryAfter
      ? t('error.tooManyAttempts', { wait: formatWait(error.retryAfter, t) })
      : t('error.tooManyRequests');
  }

  if (isKnownCode(error.code)) {
    return t(`error.code.${error.code}`);
  }

  if (error.status === 400) {
    const first = error.issues[0];
    return first
      ? t('error.invalidDataField', { field: first.path || t('error.request'), message: first.message })
      : t('error.invalidData');
  }

  if (error.status >= 500) {
    return t('error.server');
  }

  return t('error.generic');
}
