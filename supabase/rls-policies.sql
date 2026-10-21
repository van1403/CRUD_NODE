ALTER TABLE public.empleado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicio ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.empleado,
  public.tecnico,
  public.cliente,
  public.servicio
TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

DROP POLICY IF EXISTS empleado_authenticated_all ON public.empleado;
CREATE POLICY empleado_authenticated_all ON public.empleado
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tecnico_authenticated_all ON public.tecnico;
CREATE POLICY tecnico_authenticated_all ON public.tecnico
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cliente_authenticated_all ON public.cliente;
CREATE POLICY cliente_authenticated_all ON public.cliente
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS servicio_authenticated_all ON public.servicio;
CREATE POLICY servicio_authenticated_all ON public.servicio
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
