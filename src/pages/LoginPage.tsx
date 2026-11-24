// @template:login-password:start
import { useState, type FormEvent } from 'react';
// @template:login-password:end
import { Navigate, useLocation } from 'react-router';
import { APP_NAME } from '@/app-info';
import { useAuth } from '@/auth/auth-context';
import { safeReturnPath } from '@/auth/return-path';
import { Button } from '@/components/Button';
import { CenteredCard } from '@/components/CenteredCard';
// @template:login-password:start
import { TextField } from '@/components/fields';
// @template:login-password:end
import { LoadingScreen } from '@/components/LoadingScreen';
// @template:login-password:start
import { Spinner } from '@/components/Spinner';
// @template:login-password:end
import { useT } from '@/i18n/i18n-context';
import { LanguageSwitch } from '@/i18n/LanguageSwitch';
// @template:login-password:start
import { errorMessage } from '@/lib/errors';
// @template:login-password:end

export function LoginPage() {
  const t = useT();
  const {
    state,
    // @template:login-password:start
    login,
    // @template:login-password:end
    // @template:login-google:start
    startLogin,
    // @template:login-google:end
  } = useAuth();
  const location = useLocation();
  const from = safeReturnPath((location.state as { from?: string } | null)?.from);

  // @template:login-password:start
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // @template:login-password:end

  if (state.status === 'loading') return <LoadingScreen />;
  // With a session, with no access, or with the service down, the page the user wanted shows which.
  if (state.status !== 'anonymous') return <Navigate to={from} replace />;

  // @template:login-password:start
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (email.trim() === '' || password === '') {
      setError(t('login.required'));
      return;
    }

    setPending(true);
    setError(null);

    try {
      await login(email.trim(), password);
    } catch (failure) {
      setError(errorMessage(failure, t));
      setPending(false);
    }
  }
  // @template:login-password:end

  return (
    <CenteredCard title={APP_NAME}>
      {state.notice && <p role="alert" className="text-body-md text-error">{t(`login.notice.${state.notice}`)}</p>}
      {/* @template:login-password:start */}
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        <p className="text-center text-body-md text-on-surface-variant">{t('login.prompt.password')}</p>
        <TextField label={t('login.email')} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus />
        <TextField label={t('login.password')} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <p role="alert" className="text-body-md text-error">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Spinner size={16} />}
          {pending ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
      {/* @template:login-password:end */}
      {/* @template:login-google:start */}
      <div className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface-variant">{t('login.prompt.google')}</p>
        <Button className="w-full" onClick={() => startLogin(from)}>{t('login.google')}</Button>
      </div>
      {/* @template:login-google:end */}
      <LanguageSwitch />
    </CenteredCard>
  );
}
