const { createAuthenticatedClient, supabase } = require('../config/db');

function readAccessToken(req) {
  const authorization = req.get('authorization');
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.slice(7);
  }

  const cookies = (req.headers.cookie || '').split(';');
  const accessCookie = cookies.find((cookie) =>
    cookie.trim().startsWith('sb-access-token=')
  );

  if (!accessCookie) {
    return null;
  }

  try {
    return decodeURIComponent(accessCookie.trim().slice('sb-access-token='.length));
  } catch {
    return null;
  }
}

function clearAccessCookie(res) {
  res.clearCookie('sb-access-token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

async function requireAuth(req, res, next) {
  const accessToken = readAccessToken(req);
  if (!accessToken) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'Inicia sesión para acceder a este recurso.' });
    }
    return res.redirect('/login');
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    clearAccessCookie(res);
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ error: 'La sesión no es válida. Inicia sesión de nuevo.' });
    }
    return res.redirect('/login');
  }

  req.user = data.user;
  req.supabase = createAuthenticatedClient(accessToken);
  return next();
}

module.exports = { requireAuth };
