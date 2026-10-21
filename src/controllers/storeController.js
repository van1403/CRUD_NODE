const { supabase } = require('../config/db');

const categories = {
  computo: 'Cómputo',
  perifericos: 'Periféricos',
  software: 'Software',
  conectividad: 'Conectividad'
};

async function home(req, res) {
  const { data: productos, error } = await supabase
    .from('producto')
    .select('id_producto, nombre, descripcion, categoria, precio, stock, imagen_url')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    if (error.code !== '42P01' && error.code !== 'PGRST205') {
      console.error('Error al cargar catálogo:', error);
    }
    return res.render('store/home', {
      productos: [],
      catalogReady: false,
      categories
    });
  }

  return res.render('store/home', {
    productos,
    catalogReady: true,
    categories
  });
}

function cart(req, res) {
  return res.render('store/cart');
}

function serviceRequestForm(req, res) {
  return res.render('store/service-request', {
    errorMessage: null,
    values: {}
  });
}

async function adminProducts(req, res) {
  const { data: productos, error } = await req.supabase
    .from('producto')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al cargar inventario:', error);
    return res.status(500).send(
      'No se pudo cargar el inventario. Confirma que ejecutaste supabase/store-schema.sql.'
    );
  }
  return res.render('admin/products', {
    productos,
    categories,
    errorMessage: req.query.error === 'producto'
      ? 'No se pudo guardar el producto; revisa sus datos.'
      : null,
    successMessage: req.query.saved === '1'
      ? 'El producto se guardó correctamente.'
      : null
  });
}

function validateProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Envía los datos del producto en un formulario válido.' };
  }

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
  const categoria = body.categoria;
  const precio = Number(body.precio);
  const stock = Number(body.stock);
  const imagenUrl = typeof body.imagen_url === 'string' ? body.imagen_url.trim() : '';

  if (!nombre || nombre.length > 120) {
    return { error: 'El nombre es obligatorio y admite hasta 120 caracteres.' };
  }
  if (descripcion.length > 2000) {
    return { error: 'La descripción admite hasta 2000 caracteres.' };
  }
  if (body.descripcion !== undefined && typeof body.descripcion !== 'string') {
    return { error: 'La descripción debe ser texto.' };
  }
  if (body.imagen_url !== undefined && typeof body.imagen_url !== 'string') {
    return { error: 'La URL de imagen debe ser texto.' };
  }
  if (!Object.hasOwn(categories, categoria)) {
    return { error: 'Selecciona una categoría válida.' };
  }
  if (
    typeof body.precio !== 'string' ||
    body.precio.trim() === '' ||
    !Number.isFinite(precio) ||
    precio < 0 ||
    precio > 99999999.99 ||
    Math.abs(precio * 100 - Math.round(precio * 100)) >=
      Number.EPSILON * Math.max(1, Math.abs(precio * 100))
  ) {
    return { error: 'El precio debe ser válido y tener hasta dos decimales.' };
  }
  if (
    typeof body.stock !== 'string' ||
    body.stock.trim() === '' ||
    !Number.isSafeInteger(stock) ||
    stock < 0
  ) {
    return { error: 'El stock debe ser un entero igual o mayor a cero.' };
  }
  if (imagenUrl.length > 2000) {
    return { error: 'La URL de imagen admite hasta 2000 caracteres.' };
  }
  if (imagenUrl) {
    try {
      const parsedUrl = new URL(imagenUrl);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return { error: 'La imagen debe usar una dirección HTTP o HTTPS.' };
      }
    } catch {
      return { error: 'Ingresa una URL válida para la imagen.' };
    }
  }

  return {
    values: {
      nombre,
      descripcion,
      categoria,
      precio,
      stock,
      imagen_url: imagenUrl || null
    }
  };
}

async function saveProduct(req, res) {
  const validation = validateProduct(req.body);
  if (validation.error) {
    return res.status(400).send(validation.error);
  }

  const id = req.params.id ? Number(req.params.id) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) {
    return res.status(400).send('El id del producto no es válido.');
  }

  const query = id === null
    ? req.supabase.from('producto').insert(validation.values)
    : req.supabase.from('producto').update({
      ...validation.values,
      actualizado_en: new Date().toISOString()
    }).eq('id_producto', id);
  const { data, error } = await query.select('id_producto').maybeSingle();

  if (error) {
    console.error('Error al guardar producto:', error);
    return res.status(500).redirect('/admin/productos?error=producto');
  }
  if (id !== null && !data) {
    return res.status(404).send('No se encontró el producto.');
  }
  return res.redirect('/admin/productos?saved=1');
}

async function deleteProduct(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).send('El id del producto no es válido.');
  }

  const { data, error } = await req.supabase
    .from('producto')
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq('id_producto', id)
    .eq('activo', true)
    .select('id_producto')
    .maybeSingle();

  if (error) {
    console.error('Error al retirar producto del catálogo:', error);
    return res.status(500).redirect('/admin/productos?error=producto');
  }
  if (!data) {
    return res.status(404).send('No se encontró un producto activo con ese id.');
  }
  return res.redirect('/admin/productos?saved=1');
}

async function updateProductStatus(req, res) {
  const id = Number(req.params.id);
  const activo = req.body.activo === 'true';
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).send('El id del producto no es válido.');
  }

  const { data, error } = await req.supabase
    .from('producto')
    .update({ activo, actualizado_en: new Date().toISOString() })
    .eq('id_producto', id)
    .select('id_producto')
    .maybeSingle();

  if (error) {
    console.error('Error al cambiar publicación del producto:', error);
    return res.status(500).redirect('/admin/productos?error=producto');
  }
  if (!data) {
    return res.status(404).send('No se encontró el producto.');
  }
  return res.redirect('/admin/productos?saved=1');
}

async function adminOrders(req, res) {
  const { data: pedidos, error } = await req.supabase
    .from('pedido')
    .select('*, detalle_pedido(*)')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al cargar pedidos:', error);
    return res.status(500).send('No se pudieron cargar los pedidos.');
  }
  return res.render('admin/orders', {
    pedidos,
    successMessage: req.query.updated === '1' ? 'Se actualizó el pedido.' : null,
    errorMessage: req.query.error === 'stock'
      ? 'No se pudo confirmar: uno o más productos ya no tienen stock suficiente.'
      : null
  });
}

async function updateOrderStatus(req, res) {
  const id = Number(req.params.id);
  const estado = req.body.estado;
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).send('El id del pedido no es válido.');
  }
  if (!['confirmado', 'enviado', 'cancelado'].includes(estado)) {
    return res.status(400).send('El estado indicado no es válido.');
  }

  const { error } = await req.supabase.rpc('actualizar_estado_pedido', {
    p_id_pedido: id,
    p_estado: estado
  });
  if (error) {
    if (error.code === 'P0001') {
      return res.redirect('/admin/pedidos?error=stock');
    }
    if (error.code === '22023') {
      return res.status(409).send('No se permite ese cambio de estado para el pedido.');
    }
    if (error.code === 'P0002') {
      return res.status(404).send('No se encontró el pedido.');
    }
    console.error('Error al actualizar estado del pedido:', error);
    return res.status(500).send('No se pudo actualizar el pedido.');
  }
  return res.redirect('/admin/pedidos?updated=1');
}

async function adminRepairs(req, res) {
  const { data: solicitudes, error } = await req.supabase
    .from('solicitud_tecnica')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al cargar solicitudes técnicas:', error);
    return res.status(500).send('No se pudieron cargar las solicitudes técnicas.');
  }
  return res.render('admin/repairs', {
    solicitudes,
    successMessage: req.query.updated === '1' ? 'Se actualizó la solicitud técnica.' : null
  });
}

async function updateRepairStatus(req, res) {
  const id = Number(req.params.id);
  const estado = req.body.estado;
  const allowedStatuses = ['pendiente', 'en_revision', 'en_reparacion', 'listo', 'cancelado'];
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).send('El id de la solicitud no es válido.');
  }
  if (!allowedStatuses.includes(estado)) {
    return res.status(400).send('El estado indicado no es válido.');
  }

  const { data, error } = await req.supabase
    .from('solicitud_tecnica')
    .update({ estado })
    .eq('id_solicitud', id)
    .select('id_solicitud')
    .maybeSingle();

  if (error) {
    console.error('Error al actualizar solicitud técnica:', error);
    return res.status(500).send('No se pudo actualizar la solicitud.');
  }
  if (!data) {
    return res.status(404).send('No se encontró la solicitud técnica.');
  }
  return res.redirect('/admin/servicio-tecnico?updated=1');
}

module.exports = {
  home,
  cart,
  serviceRequestForm,
  adminProducts,
  saveProduct,
  deleteProduct,
  updateProductStatus,
  adminOrders,
  updateOrderStatus,
  adminRepairs,
  updateRepairStatus
};
