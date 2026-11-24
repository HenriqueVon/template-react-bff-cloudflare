import { defineMessages } from '../define-messages';

// The messages of the errors, by the code of the API or of the Functions of this app.
export const errors = defineMessages({
  'en': {
    'error.code.AUTH_TOKEN_EXPIRED'   : 'Your session has expired. Sign in again.',
    'error.code.AUTH_TOKEN_INVALID'   : 'Your session is no longer valid. Sign in again.',
    'error.code.AUTH_SESSION_REVOKED' : 'Your session was ended. Sign in again.',
    'error.code.AUTH_SESSION_MISSING' : 'You are not signed in.',
    // @template:login-password:start
    'error.code.AUTH_INVALID_CREDENTIALS' : 'The email or the password is wrong.',
    // @template:login-password:end
    // @template:login-google:start
    'error.code.AUTH_CODE_INVALID'    : 'The sign-in could not be completed. Try again.',
    'error.code.LOGIN_STATE_INVALID'  : 'The sign-in expired or is invalid. Try again.',
    // @template:login-google:end
    'error.code.FORBIDDEN'            : 'Your account has no access to this app.',
    'error.code.CSRF_REJECTED'        : 'The request was refused for security. Reload the page.',
    'error.code.API_UNAVAILABLE'      : 'Could not reach the server. Try again in a moment.',
    'error.code.BFF_MISCONFIGURED'    : 'The app is not configured correctly. Tell the person in charge.',
    'error.code.METHOD_NOT_ALLOWED'   : 'Operation not allowed.',
    'error.code.NETWORK_ERROR'        : 'No connection to the server. Check your internet and try again.',
    'error.code.NOT_FOUND'            : 'Not found. It may have been removed.',
    'error.code.CONFLICT'             : 'A record with this data already exists, or it is in use.',
    'error.code.PAYLOAD_TOO_LARGE'    : 'The data sent is too large.',
    'error.seconds'                   : '{count} seconds',
    'error.minute'                    : '1 minute',
    'error.minutes'                   : '{count} minutes',
    'error.tooManyAttempts'           : 'Too many attempts. Try again in {wait}.',
    'error.tooManyRequests'           : 'Too many requests in a short time. Wait a moment and try again.',
    'error.invalidData'               : 'Invalid data. Check the fields.',
    'error.invalidDataField'          : 'Invalid data ({field}): {message}',
    'error.request'                   : 'request',
    'error.server'                    : 'The server had an unexpected error. Try again in a moment.',
    'error.generic'                   : 'Something went wrong. Try again.',
  },
  'pt-BR': {
    'error.code.AUTH_TOKEN_EXPIRED'   : 'Sua sessão expirou. Entre de novo.',
    'error.code.AUTH_TOKEN_INVALID'   : 'Sua sessão não é mais válida. Entre de novo.',
    'error.code.AUTH_SESSION_REVOKED' : 'Sua sessão foi encerrada. Entre de novo.',
    'error.code.AUTH_SESSION_MISSING' : 'Você não está conectado.',
    // @template:login-password:start
    'error.code.AUTH_INVALID_CREDENTIALS' : 'O email ou a senha está errado.',
    // @template:login-password:end
    // @template:login-google:start
    'error.code.AUTH_CODE_INVALID'    : 'Não foi possível concluir o login. Tente de novo.',
    'error.code.LOGIN_STATE_INVALID'  : 'O login expirou ou é inválido. Tente de novo.',
    // @template:login-google:end
    'error.code.FORBIDDEN'            : 'Sua conta não tem acesso a este app.',
    'error.code.CSRF_REJECTED'        : 'A requisição foi recusada por segurança. Recarregue a página.',
    'error.code.API_UNAVAILABLE'      : 'Não foi possível falar com o servidor. Tente de novo em instantes.',
    'error.code.BFF_MISCONFIGURED'    : 'O app não está configurado corretamente. Avise o responsável.',
    'error.code.METHOD_NOT_ALLOWED'   : 'Operação não permitida.',
    'error.code.NETWORK_ERROR'        : 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
    'error.code.NOT_FOUND'            : 'Não encontrado. Talvez tenha sido removido.',
    'error.code.CONFLICT'             : 'Já existe um registro com esses dados, ou ele está em uso.',
    'error.code.PAYLOAD_TOO_LARGE'    : 'Os dados enviados são grandes demais.',
    'error.seconds'                   : '{count} segundos',
    'error.minute'                    : '1 minuto',
    'error.minutes'                   : '{count} minutos',
    'error.tooManyAttempts'           : 'Muitas tentativas. Tente de novo em {wait}.',
    'error.tooManyRequests'           : 'Muitas requisições em pouco tempo. Aguarde um pouco e tente de novo.',
    'error.invalidData'               : 'Dados inválidos. Revise os campos.',
    'error.invalidDataField'          : 'Dados inválidos ({field}): {message}',
    'error.request'                   : 'requisição',
    'error.server'                    : 'O servidor teve um erro inesperado. Tente de novo em instantes.',
    'error.generic'                   : 'Algo deu errado. Tente de novo.',
  },
});

// The codes that have a message of their own; any other code falls back to the one of its status.
export const ERROR_CODES = [
  'AUTH_TOKEN_EXPIRED', 'AUTH_TOKEN_INVALID', 'AUTH_SESSION_REVOKED', 'AUTH_SESSION_MISSING',
  // @template:login-password:start
  'AUTH_INVALID_CREDENTIALS',
  // @template:login-password:end
  // @template:login-google:start
  'AUTH_CODE_INVALID', 'LOGIN_STATE_INVALID',
  // @template:login-google:end
  'FORBIDDEN', 'CSRF_REJECTED', 'API_UNAVAILABLE', 'BFF_MISCONFIGURED', 'METHOD_NOT_ALLOWED', 'NETWORK_ERROR', 'NOT_FOUND',
  'CONFLICT', 'PAYLOAD_TOO_LARGE',
] as const;
