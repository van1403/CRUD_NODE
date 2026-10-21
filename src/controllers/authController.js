const { supabase } = require('../config/db');

function loginPage(req, res) {
  return res.render('client/login', { errorMessage: null });
}

async function login(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).render('client/login', {
      errorMessage: 'Ingresa tu correo y contraseña.'
    });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).render('client/login', {
      errorMessage: 'No se pudo iniciar sesión. Verifica tus datos o contacta al administrador.'
    });
  }

  res.cookie('sb-access-token', data.session.access_token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: data.session.expires_in * 1000,
    path: '/'
  });
  return res.redirect('/admin/productos');
}

function logout(req, res) {
  res.clearCookie('sb-access-token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
  return res.redirect('/login');
}

module.exports = { loginPage, login, logout };
