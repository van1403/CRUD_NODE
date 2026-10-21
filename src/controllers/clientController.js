const clientFields = {
  nombre: { type: 'string', required: true, maxLength: 100 },
  dni: { type: 'string', nullable: true, maxLength: 8, exactLength: 8 },
  celular: { type: 'string', nullable: true, maxLength: 9, exactLength: 9 },
  id_tecnico: { type: 'integer', nullable: true }
};

function validateClient(body, isCreate) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'El cuerpo debe ser un objeto JSON.';
  }

  const errors = [];
  for (const [key, value] of Object.entries(body)) {
    const field = clientFields[key];
    if (!field) {
      errors.push(`El campo "${key}" no está permitido.`);
      continue;
    }
    if (value === null) {
      if (!field.nullable) {
        errors.push(`El campo "${key}" no puede ser null.`);
      }
      continue;
    }
    if (field.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`El campo "${key}" debe ser texto.`);
      } else if (field.required && value.trim().length === 0) {
        errors.push(`El campo "${key}" no puede estar vacío.`);
      } else if (value.length > field.maxLength) {
        errors.push(`El campo "${key}" debe tener como máximo ${field.maxLength} caracteres.`);
      } else if (field.exactLength && value.length !== field.exactLength) {
        errors.push(`El campo "${key}" debe tener exactamente ${field.exactLength} caracteres.`);
      }
    } else if (!Number.isSafeInteger(value) || value <= 0) {
      errors.push(`El campo "${key}" debe ser un entero positivo.`);
    }
  }

  if (isCreate && !Object.hasOwn(body, 'nombre')) {
    errors.push('El campo "nombre" es obligatorio.');
  }
  if (!isCreate && Object.keys(body).length === 0) {
    errors.push('Envía al menos un campo para actualizar.');
  }

  return errors.length > 0 ? errors.join(' ') : null;
}

function databaseError(res, error) {
  if (error.code === '42501') {
    return res.status(403).json({
      error: 'Supabase bloqueó la operación por RLS. Ejecuta supabase/rls-policies.sql.'
    });
  }
  if (error.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  }
  if (error.code === '23503') {
    return res.status(400).json({
      error: 'La referencia indicada no existe o el cliente está relacionado con otros datos.'
    });
  }
  if (error.code === '23502' || error.code === '22P02') {
    return res.status(400).json({ error: 'Los datos enviados no son válidos.' });
  }

  console.error('Error al consultar Supabase:', error);
  return res.status(500).json({ error: 'No se pudo completar la operación en la base de datos.' });
}

function pageDatabaseError(res, error) {
  if (error.code === '42501') {
    return res.status(403).send(
      'Supabase rechazó la operación por las políticas RLS. Revisa los permisos de la tabla en Supabase.'
    );
  }
  if (error.code === '23503') {
    return res.status(409).send(
      'No se puede eliminar el cliente porque tiene servicios asociados.'
    );
  }
  console.error('Error al consultar Supabase:', error);
  return res.status(500).send('No se pudo completar la operación en la base de datos.');
}

function clientFormValues(body) {
  return {
    nombre: body.nombre,
    dni: body.dni || null,
    celular: body.celular || null,
    id_tecnico: body.id_tecnico ? Number(body.id_tecnico) : null
  };
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function dashboard(req, res) {
  const { data: clientes, error } = await req.supabase
    .from('cliente')
    .select('id_cliente, nombre, dni, celular, id_tecnico')
    .order('id_cliente', { ascending: true });

  if (error) {
    return pageDatabaseError(res, error);
  }
  return res.render('client/dashboard', {
    clientes,
    errorMessage: null,
    query: req.query
  });
}

async function details(req, res) {
  const id = validId(req.params.id);
  if (!id) {
    return res.status(400).send('El id debe ser un entero positivo.');
  }

  const { data: cliente, error } = await req.supabase
    .from('cliente')
    .select('*')
    .eq('id_cliente', id)
    .maybeSingle();

  if (error) {
    return pageDatabaseError(res, error);
  }
  if (!cliente) {
    return res.status(404).send('No se encontró el cliente.');
  }

  const { data: servicios, error: serviceError } = await req.supabase
    .from('servicio')
    .select('id_servicio, monto, fecha_servicio')
    .eq('id_cliente', id)
    .order('fecha_servicio', { ascending: false });

  if (serviceError) {
    return pageDatabaseError(res, serviceError);
  }
  return res.render('client/detalles', {
    cliente,
    servicios,
    query: req.query
  });
}

async function showServiceRequest(req, res) {
  const { data: clientes, error } = await req.supabase
    .from('cliente')
    .select('id_cliente, nombre')
    .order('nombre', { ascending: true });

  if (error) {
    return pageDatabaseError(res, error);
  }
  return res.render('client/solicita', {
    clientes,
    errorMessage: null,
    values: {}
  });
}

async function createClient(req, res) {
  const values = clientFormValues(req.body);
  const validationError = validateClient(values, true);
  if (validationError) {
    const { data: clientes, error } = await req.supabase
      .from('cliente')
      .select('id_cliente, nombre, dni, celular, id_tecnico')
      .order('id_cliente', { ascending: true });
    if (error) {
      return pageDatabaseError(res, error);
    }
    return res.status(400).render('client/dashboard', {
      clientes,
      errorMessage: validationError,
      query: req.query
    });
  }

  const { error } = await req.supabase.from('cliente').insert(values);
  if (error) {
    if (error.code === '23505') {
      return res.status(409).redirect('/clientes?error=dni');
    }
    return pageDatabaseError(res, error);
  }
  return res.redirect('/clientes');
}

async function updateClientPage(req, res) {
  const id = validId(req.params.id);
  const values = clientFormValues(req.body);
  const validationError = validateClient(values, false);
  if (!id || validationError) {
    return res.status(400).send(validationError || 'El id debe ser un entero positivo.');
  }

  const { data, error } = await req.supabase
    .from('cliente')
    .update(values)
    .eq('id_cliente', id)
    .select('id_cliente')
    .maybeSingle();

  if (error) {
    return pageDatabaseError(res, error);
  }
  if (!data) {
    return res.status(404).send('No se encontró el cliente.');
  }
  return res.redirect(`/clientes/${id}`);
}

async function deleteClientPage(req, res) {
  const id = validId(req.params.id);
  if (!id) {
    return res.status(400).send('El id debe ser un entero positivo.');
  }

  const { data, error } = await req.supabase
    .from('cliente')
    .delete()
    .eq('id_cliente', id)
    .select('id_cliente')
    .maybeSingle();

  if (error) {
    return pageDatabaseError(res, error);
  }
  if (!data) {
    return res.status(404).send('No se encontró el cliente.');
  }
  return res.redirect('/clientes');
}

async function createServiceRequest(req, res) {
  const { data: clientes, error: clientsError } = await req.supabase
    .from('cliente')
    .select('id_cliente, nombre')
    .order('nombre', { ascending: true });

  if (clientsError) {
    return pageDatabaseError(res, clientsError);
  }

  const idCliente = validId(req.body.id_cliente);
  const monto =
    req.body.monto === undefined || req.body.monto === ''
      ? null
      : Number(req.body.monto);
  const fechaServicio = req.body.fecha_servicio || null;
  const values = { id_cliente: idCliente, monto, fecha_servicio: fechaServicio };
  let errorMessage = null;

  if (!idCliente) {
    errorMessage = 'Selecciona un cliente válido.';
  } else if (
    monto !== null &&
    (!Number.isFinite(monto) ||
      monto < 0 ||
      monto > 99999999.99 ||
      Math.abs(monto * 100 - Math.round(monto * 100)) >=
        Number.EPSILON * Math.max(1, Math.abs(monto * 100)))
  ) {
    errorMessage = 'El monto debe ser positivo y tener hasta dos decimales.';
  } else if (
    fechaServicio !== null &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(fechaServicio) ||
      Number.isNaN(Date.parse(`${fechaServicio}T00:00:00.000Z`)) ||
      new Date(`${fechaServicio}T00:00:00.000Z`).toISOString().slice(0, 10) !== fechaServicio)
  ) {
    errorMessage = 'La fecha debe ser válida y tener formato AAAA-MM-DD.';
  }

  if (errorMessage) {
    return res.status(400).render('client/solicita', {
      clientes,
      errorMessage,
      values: req.body
    });
  }

  const { error } = await req.supabase.from('servicio').insert(values);
  if (error) {
    return pageDatabaseError(res, error);
  }
  return res.redirect(`/clientes/${idCliente}?solicitud=creada`);
}

async function listApi(req, res) {
  const { data, error } = await req.supabase
    .from('cliente')
    .select('*')
    .order('id_cliente', { ascending: true });
  if (error) {
    return databaseError(res, error);
  }
  return res.json(data);
}

async function getApi(req, res) {
  const id = validId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'El id debe ser un entero positivo.' });
  }

  const { data, error } = await req.supabase
    .from('cliente')
    .select('*')
    .eq('id_cliente', id)
    .maybeSingle();
  if (error) {
    return databaseError(res, error);
  }
  if (!data) {
    return res.status(404).json({ error: 'No se encontró el registro.' });
  }
  return res.json(data);
}

async function createApi(req, res) {
  const validationError = validateClient(req.body, true);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { data, error } = await req.supabase
    .from('cliente')
    .insert(req.body)
    .select()
    .single();
  if (error) {
    return databaseError(res, error);
  }
  return res.status(201).json(data);
}

async function updateApi(req, res) {
  const id = validId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'El id debe ser un entero positivo.' });
  }

  const validationError = validateClient(req.body, false);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { data, error } = await req.supabase
    .from('cliente')
    .update(req.body)
    .eq('id_cliente', id)
    .select()
    .maybeSingle();
  if (error) {
    return databaseError(res, error);
  }
  if (!data) {
    return res.status(404).json({ error: 'No se encontró el registro.' });
  }
  return res.json(data);
}

async function deleteApi(req, res) {
  const id = validId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'El id debe ser un entero positivo.' });
  }

  const { data, error } = await req.supabase
    .from('cliente')
    .delete()
    .eq('id_cliente', id)
    .select('id_cliente')
    .maybeSingle();
  if (error) {
    return databaseError(res, error);
  }
  if (!data) {
    return res.status(404).json({ error: 'No se encontró el registro.' });
  }
  return res.status(204).send();
}

module.exports = {
  dashboard,
  details,
  showServiceRequest,
  createClient,
  updateClientPage,
  deleteClientPage,
  createServiceRequest,
  listApi,
  getApi,
  createApi,
  updateApi,
  deleteApi
};
