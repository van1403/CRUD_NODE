const { supabase } = require('../config/db');

const submissionTimes = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;

function rateLimitSubmission(req, res, next) {
  const now = Date.now();
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  const recentTimes = (submissionTimes.get(clientKey) || [])
    .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (submissionTimes.size > 10_000) {
    for (const [key, timestamps] of submissionTimes) {
      if (!timestamps.some((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)) {
        submissionTimes.delete(key);
      }
    }
  }

  if (recentTimes.length >= MAX_SUBMISSIONS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Se recibieron varias solicitudes seguidas. Espera un minuto e inténtalo de nuevo.'
    });
  }

  recentTimes.push(now);
  submissionTimes.set(clientKey, recentTimes);
  return next();
}

function invalidString(value, minLength, maxLength) {
  return typeof value !== 'string' ||
    value.trim().length < minLength ||
    value.trim().length > maxLength;
}

function validateCustomer(body) {
  if (invalidString(body.nombre, 2, 120)) {
    return 'Ingresa tu nombre (2 a 120 caracteres).';
  }
  if (invalidString(body.telefono, 7, 20)) {
    return 'Ingresa un teléfono válido.';
  }
  if (body.correo && (
    typeof body.correo !== 'string' ||
    body.correo.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.correo)
  )) {
    return 'Ingresa un correo válido.';
  }
  return null;
}

async function createOrder(req, res) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Envía los datos del pedido en formato JSON.' });
  }

  const customerError = validateCustomer(req.body);
  if (customerError) {
    return res.status(400).json({ error: customerError });
  }

  const items = req.body.productos;
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    return res.status(400).json({ error: 'El carrito debe tener entre 1 y 50 productos.' });
  }
  const seenIds = new Set();
  for (const item of items) {
    if (
      !item ||
      !Number.isSafeInteger(item.id_producto) ||
      item.id_producto <= 0 ||
      !Number.isSafeInteger(item.cantidad) ||
      item.cantidad < 1 ||
      item.cantidad > 99 ||
      seenIds.has(item.id_producto)
    ) {
      return res.status(400).json({ error: 'El carrito contiene un producto o una cantidad inválidos.' });
    }
    seenIds.add(item.id_producto);
  }

  let data;
  let error;
  try {
    ({ data, error } = await supabase.rpc('crear_pedido_tienda', {
      p_nombre_cliente: req.body.nombre.trim(),
      p_telefono: req.body.telefono.trim(),
      p_correo: req.body.correo?.trim() || null,
      p_productos: items
    }));
  } catch (requestError) {
    console.error('No se pudo conectar con Supabase para registrar el pedido:', requestError);
    return res.status(503).json({ error: 'La tienda no puede registrar pedidos en este momento.' });
  }

  if (error) {
    if (error.code === 'P0001') {
      return res.status(409).json({ error: error.message });
    }
    if (error.code === '22023' || error.code === '22P02' || error.code === '22003') {
      return res.status(400).json({ error: 'El pedido contiene datos inválidos.' });
    }
    console.error('Error al registrar pedido:', error);
    return res.status(500).json({ error: 'No se pudo registrar el pedido.' });
  }

  const order = Array.isArray(data) ? data[0] : data;
  return res.status(201).json({
    id_pedido: order.id_pedido,
    total: order.total,
    estado: order.estado
  });
}

async function createRepairRequest(req, res) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Envía los datos en formato JSON.' });
  }

  const customerError = validateCustomer(req.body);
  if (customerError) {
    return res.status(400).json({ error: customerError });
  }
  if (invalidString(req.body.equipo, 2, 120)) {
    return res.status(400).json({ error: 'Indica el tipo de equipo (2 a 120 caracteres).' });
  }
  if (invalidString(req.body.descripcion, 10, 2000)) {
    return res.status(400).json({
      error: 'Describe el problema con entre 10 y 2000 caracteres.'
    });
  }

  let data;
  let error;
  try {
    ({ data, error } = await supabase.rpc('crear_solicitud_tecnica', {
      p_nombre_cliente: req.body.nombre.trim(),
      p_telefono: req.body.telefono.trim(),
      p_correo: req.body.correo?.trim() || null,
      p_equipo: req.body.equipo.trim(),
      p_descripcion: req.body.descripcion.trim()
    }));
  } catch (requestError) {
    console.error('No se pudo conectar con Supabase para registrar la solicitud:', requestError);
    return res.status(503).json({
      error: 'No se puede registrar la solicitud técnica en este momento.'
    });
  }

  if (error) {
    if (error.code === '22023') {
      return res.status(400).json({ error: 'Completa correctamente todos los datos de la solicitud.' });
    }
    console.error('Error al registrar solicitud técnica:', error);
    return res.status(500).json({ error: 'No se pudo registrar la solicitud técnica.' });
  }

  const request = Array.isArray(data) ? data[0] : data;
  return res.status(201).json({
    id_solicitud: request.id_solicitud,
    estado: request.estado
  });
}

module.exports = {
  rateLimitSubmission,
  createOrder,
  createRepairRequest
};
