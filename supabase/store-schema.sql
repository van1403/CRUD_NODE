CREATE TABLE IF NOT EXISTS public.producto (
  id_producto INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  categoria VARCHAR(30) NOT NULL
    CHECK (categoria IN ('computo', 'perifericos', 'software', 'conectividad')),
  precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0 AND precio <= 99999999.99),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  imagen_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedido (
  id_pedido INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_cliente VARCHAR(120) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  correo VARCHAR(254),
  total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'confirmado', 'enviado', 'cancelado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.detalle_pedido (
  id_detalle INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pedido INT NOT NULL REFERENCES public.pedido(id_pedido) ON DELETE CASCADE,
  id_producto INT REFERENCES public.producto(id_producto) ON DELETE SET NULL,
  nombre_producto VARCHAR(120) NOT NULL,
  precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),
  cantidad INT NOT NULL CHECK (cantidad > 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS public.solicitud_tecnica (
  id_solicitud INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_cliente VARCHAR(120) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  correo VARCHAR(254),
  equipo VARCHAR(120) NOT NULL,
  descripcion TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_revision', 'en_reparacion', 'listo', 'cancelado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitud_tecnica ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.producto TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.producto TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.pedido,
  public.detalle_pedido,
  public.solicitud_tecnica
TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE
  public.producto_id_producto_seq,
  public.pedido_id_pedido_seq,
  public.detalle_pedido_id_detalle_seq,
  public.solicitud_tecnica_id_solicitud_seq
TO authenticated;

DROP POLICY IF EXISTS producto_catalogo_publico ON public.producto;
CREATE POLICY producto_catalogo_publico ON public.producto
  FOR SELECT TO anon, authenticated
  USING (activo = true);

DROP POLICY IF EXISTS producto_admin_all ON public.producto;
CREATE POLICY producto_admin_all ON public.producto
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pedido_admin_all ON public.pedido;
CREATE POLICY pedido_admin_all ON public.pedido
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS detalle_pedido_admin_all ON public.detalle_pedido;
CREATE POLICY detalle_pedido_admin_all ON public.detalle_pedido
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS solicitud_tecnica_admin_all ON public.solicitud_tecnica;
CREATE POLICY solicitud_tecnica_admin_all ON public.solicitud_tecnica
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.crear_pedido_tienda(
  p_nombre_cliente TEXT,
  p_telefono TEXT,
  p_correo TEXT,
  p_productos JSONB
)
RETURNS TABLE (id_pedido INT, total NUMERIC, estado TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pedido_id INT;
  v_total NUMERIC(14, 2) := 0;
  v_item JSONB;
  v_producto_id INT;
  v_cantidad INT;
  v_nombre VARCHAR(120);
  v_precio NUMERIC(10, 2);
  v_stock INT;
BEGIN
  IF p_nombre_cliente IS NULL OR char_length(btrim(p_nombre_cliente)) NOT BETWEEN 2 AND 120
    OR p_telefono IS NULL OR char_length(btrim(p_telefono)) NOT BETWEEN 7 AND 20
    OR (p_correo IS NOT NULL AND char_length(p_correo) > 254)
    OR p_productos IS NULL OR jsonb_typeof(p_productos) <> 'array' THEN
    RAISE EXCEPTION 'Datos del pedido inválidos' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_productos) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'El pedido debe contener entre 1 y 50 productos' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_productos) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item.value->'id_producto') IS DISTINCT FROM 'number'
      OR jsonb_typeof(item.value->'cantidad') IS DISTINCT FROM 'number'
      OR (item.value->>'id_producto') !~ '^[0-9]+$'
      OR (item.value->>'cantidad') !~ '^[0-9]+$'
  ) THEN
    RAISE EXCEPTION 'Producto o cantidad inválidos' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_productos) AS item(value)
    GROUP BY (item.value->>'id_producto')::INT
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'El carrito contiene productos duplicados' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pedido AS created_order (nombre_cliente, telefono, correo)
  VALUES (btrim(p_nombre_cliente), btrim(p_telefono), NULLIF(btrim(p_correo), ''))
  RETURNING created_order.id_pedido INTO v_pedido_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_productos)
  LOOP
    v_producto_id := (v_item->>'id_producto')::INT;
    v_cantidad := (v_item->>'cantidad')::INT;

    IF v_producto_id <= 0 OR v_cantidad NOT BETWEEN 1 AND 99 THEN
      RAISE EXCEPTION 'Producto o cantidad inválidos' USING ERRCODE = '22023';
    END IF;

    SELECT nombre, precio, stock
      INTO v_nombre, v_precio, v_stock
      FROM public.producto
      WHERE public.producto.id_producto = v_producto_id
        AND activo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Uno de los productos ya no está disponible' USING ERRCODE = 'P0001';
    END IF;
    IF v_stock < v_cantidad THEN
      RAISE EXCEPTION 'No hay stock suficiente para %', v_nombre USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.detalle_pedido
      (id_pedido, id_producto, nombre_producto, precio_unitario, cantidad, subtotal)
    VALUES
      (v_pedido_id, v_producto_id, v_nombre, v_precio, v_cantidad, v_precio * v_cantidad);

    v_total := v_total + v_precio * v_cantidad;
  END LOOP;

  UPDATE public.pedido SET total = v_total WHERE public.pedido.id_pedido = v_pedido_id;
  RETURN QUERY SELECT v_pedido_id, v_total, 'pendiente'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_solicitud_tecnica(
  p_nombre_cliente TEXT,
  p_telefono TEXT,
  p_correo TEXT,
  p_equipo TEXT,
  p_descripcion TEXT
)
RETURNS TABLE (id_solicitud INT, estado TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_solicitud_id INT;
BEGIN
  IF p_nombre_cliente IS NULL OR char_length(btrim(p_nombre_cliente)) NOT BETWEEN 2 AND 120
    OR p_telefono IS NULL OR char_length(btrim(p_telefono)) NOT BETWEEN 7 AND 20
    OR (p_correo IS NOT NULL AND char_length(p_correo) > 254)
    OR p_equipo IS NULL OR char_length(btrim(p_equipo)) NOT BETWEEN 2 AND 120
    OR p_descripcion IS NULL OR char_length(btrim(p_descripcion)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Completa correctamente los datos de la solicitud' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.solicitud_tecnica AS created_request
    (nombre_cliente, telefono, correo, equipo, descripcion)
  VALUES
    (btrim(p_nombre_cliente), btrim(p_telefono), NULLIF(btrim(p_correo), ''),
     btrim(p_equipo), btrim(p_descripcion))
  RETURNING created_request.id_solicitud INTO v_solicitud_id;

  RETURN QUERY SELECT v_solicitud_id, 'pendiente'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_estado_pedido(
  p_id_pedido INT,
  p_estado TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_estado_actual TEXT;
  v_item RECORD;
  v_stock INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere autenticación' USING ERRCODE = '42501';
  END IF;
  IF p_estado IS NULL OR p_estado NOT IN ('confirmado', 'enviado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado de pedido inválido' USING ERRCODE = '22023';
  END IF;

  SELECT estado INTO v_estado_actual
    FROM public.pedido
    WHERE id_pedido = p_id_pedido
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    (v_estado_actual = 'pendiente' AND p_estado IN ('confirmado', 'cancelado'))
    OR (v_estado_actual = 'confirmado' AND p_estado IN ('enviado', 'cancelado'))
  ) THEN
    RAISE EXCEPTION 'No se permite ese cambio de estado' USING ERRCODE = '22023';
  END IF;

  IF p_estado = 'confirmado' THEN
    FOR v_item IN
      SELECT id_producto, cantidad
        FROM public.detalle_pedido
        WHERE id_pedido = p_id_pedido
        ORDER BY id_producto
    LOOP
      IF v_item.id_producto IS NULL THEN
        RAISE EXCEPTION 'Uno de los productos ya no está disponible' USING ERRCODE = 'P0001';
      END IF;

      SELECT stock INTO v_stock
        FROM public.producto
        WHERE id_producto = v_item.id_producto
          AND activo = true
        FOR UPDATE;

      IF NOT FOUND OR v_stock < v_item.cantidad THEN
        RAISE EXCEPTION 'Ya no hay stock suficiente para confirmar este pedido' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;

    UPDATE public.producto AS product
      SET stock = product.stock - item.cantidad, actualizado_en = now()
      FROM public.detalle_pedido AS item
      WHERE item.id_pedido = p_id_pedido
        AND item.id_producto = product.id_producto;
  END IF;

  IF p_estado = 'cancelado' AND v_estado_actual = 'confirmado' THEN
    FOR v_item IN
      SELECT id_producto, cantidad
        FROM public.detalle_pedido
        WHERE id_pedido = p_id_pedido
        ORDER BY id_producto
    LOOP
      IF v_item.id_producto IS NOT NULL THEN
        UPDATE public.producto
          SET stock = stock + v_item.cantidad, actualizado_en = now()
          WHERE id_producto = v_item.id_producto;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.pedido SET estado = p_estado WHERE id_pedido = p_id_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_pedido_tienda(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_pedido_tienda(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.crear_solicitud_tecnica(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_solicitud_tecnica(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.actualizar_estado_pedido(INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_pedido(INT, TEXT) TO authenticated;
