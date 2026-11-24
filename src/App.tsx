import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ApiError } from '@/api/client';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { ToastProvider } from '@/components/ToastProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { AppShell } from '@/layout/AppShell';
// @template:login-google:start
import { CallbackPage } from '@/pages/CallbackPage';
// @template:login-google:end
// @template:example:start
import { ExamplesPage } from '@/pages/examples/ExamplesPage';
// @template:example:end
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime            : 30_000,
      refetchOnWindowFocus : false,
      // A 4xx will not change on retry; network errors and 5xx get one more try.
      retry                : (failureCount, error) =>
        failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
    mutations: {
      retry: false,
    },
  },
});

// The routes. Every route except the login ones sits inside RequireAuth and the shell. A section of the menu is listed
// in src/layout/nav-items.ts as well.
export function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                {/* @template:login-google:start */}
                <Route path="/auth/callback" element={<CallbackPage />} />
                {/* @template:login-google:end */}
                <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                  <Route path="/" element={<HomePage />} />
                  {/* @template:example:start */}
                  <Route path="/examples" element={<ExamplesPage />} />
                  {/* @template:example:end */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
