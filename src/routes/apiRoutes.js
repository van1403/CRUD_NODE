const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const clientController = require('../controllers/clientController');

const router = express.Router();
router.use(requireAuth);

const tables = {
  empleado: {
    id: 'id_empleado',
    fields: {
      nombre: { type: 'string', required: true, maxLength: 100 },
      cargo: { type: 'string', nullable: true, maxLength: 50 }
    }
  },
  tecnico: {
    id: 'id_tecnico',
    fields: {
      id_empleado: { type: 'integer', required: true }
    }
  },
  servicio: {
    id: 'id_servicio',
    fields: {
      id_cliente: { type: 'integer', required: true },
      monto: { type: 'money', nullable: true },
      fecha_servicio: { type: 'date', nullable: true }
    }
  }
};

function validateValue(value, field) {
  if (value === null) {
    return field.nullable ? null : 'no puede ser null';
  }

  if (field.type === 'string') {
    if (typeof value !== 'string') {
      return 'debe ser texto';
    }
    if (field.required && value.trim().length === 0) {
      return 'no puede estar vacío';
    }
    if (value.length > field.maxLength) {
      return `debe tener como máximo ${field.maxLength} caracteres`;
    }
    return null;
  }

  if (field.type === 'integer') {
    return Number.isSafeInteger(value) && value > 0
      ? null
      : 'debe ser un entero positivo';
  }

  if (field.type === 'money') {
    const scaledValue = value * 100;
    return typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 99999999.99 &&
      Math.abs(scaledValue - Math.round(scaledValue)) <
        Number.EPSILON * Math.max(1, Math.abs(scaledValue))
      ? null
      : 'debe ser un monto entre 0 y 99999999.99 con hasta dos decimales';
  }

  if (field.type === 'date') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'debe ser una fecha con formato YYYY-MM-DD';
    }
    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === value
      ? null
      : 'debe ser una fecha válida';
  }

  return 'tiene un tipo no admitido';
}

function validateBody(body, table, isCreate) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'El cuerpo debe ser un objeto JSON.';
  }

  const errors = [];
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(table.fields, key)) {
      errors.push(`El campo "${key}" no está permitido.`);
      continue;
    }
    const error = validateValue(body[key], table.fields[key]);
    if (error) {
      errors.push(`El campo "${key}" ${error}.`);
    }
  }

  for (const [key, field] of Object.entries(table.fields)) {
    if (isCreate && field.required && !Object.hasOwn(body, key)) {
      errors.push(`El campo "${key}" es obligatorio.`);
    }
  }

  if (!isCreate && Object.keys(body).length === 0) {
    errors.push('Envía al menos un campo para actualizar.');
  }

  return errors.length > 0 ? errors.join(' ') : null;
}

function sendDatabaseError(res, error) {
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  }
  if (error.code === '23503') {
    return res.status(400).json({
      error: 'La referencia indicada no existe o el registro está relacionado con otros datos.'
    });
  }
  if (error.code === '23502' || error.code === '22P02') {
    return res.status(400).json({ error: 'Los datos enviados no son válidos.' });
  }

  console.error('Error al consultar Supabase:', error);
  return res.status(500).json({ error: 'No se pudo completar la operación en la base de datos.' });
}

function registerCrudRoutes(tableName, table) {
  const collectionPath = `/${tableName}`;

  router.get(collectionPath, async (req, res) => {
    const { data, error } = await req.supabase
      .from(tableName)
      .select('*')
      .order(table.id, { ascending: true });
    if (error) {
      return sendDatabaseError(res, error);
    }
    return res.json(data);
  });

  router.get(`${collectionPath}/:id`, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'El id debe ser un entero positivo.' });
    }

    const { data, error } = await req.supabase
      .from(tableName)
      .select('*')
      .eq(table.id, id)
      .maybeSingle();
    if (error) {
      return sendDatabaseError(res, error);
    }
    if (!data) {
      return res.status(404).json({ error: 'No se encontró el registro.' });
    }
    return res.json(data);
  });

  router.post(collectionPath, async (req, res) => {
    const validationError = validateBody(req.body, table, true);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { data, error } = await req.supabase
      .from(tableName)
      .insert(req.body)
      .select()
      .single();
    if (error) {
      return sendDatabaseError(res, error);
    }
    return res.status(201).json(data);
  });

  router.put(`${collectionPath}/:id`, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'El id debe ser un entero positivo.' });
    }
    const validationError = validateBody(req.body, table, false);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { data, error } = await req.supabase
      .from(tableName)
      .update(req.body)
      .eq(table.id, id)
      .select()
      .maybeSingle();
    if (error) {
      return sendDatabaseError(res, error);
    }
    if (!data) {
      return res.status(404).json({ error: 'No se encontró el registro.' });
    }
    return res.json(data);
  });

  router.delete(`${collectionPath}/:id`, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'El id debe ser un entero positivo.' });
    }

    const { data, error } = await req.supabase
      .from(tableName)
      .delete()
      .eq(table.id, id)
      .select(table.id)
      .maybeSingle();
    if (error) {
      return sendDatabaseError(res, error);
    }
    if (!data) {
      return res.status(404).json({ error: 'No se encontró el registro.' });
    }
    return res.status(204).send();
  });
}

router.get('/cliente', clientController.listApi);
router.get('/cliente/:id', clientController.getApi);
router.post('/cliente', clientController.createApi);
router.put('/cliente/:id', clientController.updateApi);
router.delete('/cliente/:id', clientController.deleteApi);

for (const [tableName, table] of Object.entries(tables)) {
  registerCrudRoutes(tableName, table);
}

module.exports = router;
