# CRUD Node con Supabase

## Configuración

1. En Supabase, abre **SQL Editor**, ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql) y confirma que las tablas estén en el esquema `public`.
2. Copia `.env.example` como `.env` y completa `SUPABASE_URL` y `SUPABASE_ANON_KEY` desde **Project Settings > API**.
3. Ejecuta también [`supabase/rls-policies.sql`](./supabase/rls-policies.sql) en el SQL Editor para permitir operaciones únicamente a usuarios autenticados.
4. Ejecuta [`supabase/store-schema.sql`](./supabase/store-schema.sql) para crear el inventario, pedidos, solicitudes técnicas, políticas RLS y funciones seguras de compra.
5. En **Authentication > Users** de Supabase, crea el usuario de acceso para el área administrativa.
6. Instala dependencias con `npm install`, arranca el servidor con `npm start` y abre `http://localhost:3000`.

La tienda y el catálogo publicado son públicos. El inventario se administra en `/admin/productos`; pedidos, en `/admin/pedidos`; y solicitudes de reparación, en `/admin/servicio-tecnico`. Estas páginas requieren iniciar sesión con una cuenta de Supabase Auth. El panel de clientes está en `/clientes`; las rutas `/api` también requieren sesión.

Los pedidos pendientes no descuentan existencias. Al confirmarlos en administración, se valida y reserva el stock de forma atómica; al cancelar un pedido confirmado, el stock se devuelve. El cobro y la entrega se coordinan manualmente; no se capturan datos de tarjeta ni se integra una pasarela. La tienda permite registrar solicitudes de reparación y actualizar su estado, pero el diagnóstico, el presupuesto y la reparación se coordinan con el cliente.

Las funciones SQL públicas solo aceptan solicitudes acotadas y crean pedidos o tickets; no permiten leerlos. El inventario, los pedidos y las solicitudes solo son legibles/modificables con una sesión autenticada. Crea cuentas solo para personas autorizadas. No se usa la clave `service_role`.

## Estructura

```text
CRUD_NODE/
├── src/
│   ├── config/db.js
│   ├── middleware/requireAuth.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── clientController.js
│   │   ├── storeController.js
│   │   └── storeApiController.js
│   ├── routes/
│   │   ├── clientRoutes.js
│   │   ├── apiRoutes.js
│   │   └── storeApiRoutes.js
│   └── views/
│       ├── client/
│       │   ├── dashboard.ejs
│       │   ├── detalles.ejs
│       │   ├── solicita.ejs
│       │   └── login.ejs
│       ├── store/
│       │   ├── home.ejs
│       │   ├── cart.ejs
│       │   └── service-request.ejs
│       └── admin/
│           ├── navigation.ejs
│           ├── products.ejs
│           ├── orders.ejs
│           └── repairs.ejs
├── public/styles.css
├── public/store.js
├── public/cart.js
├── public/service-request.js
├── supabase/schema.sql
├── supabase/rls-policies.sql
├── supabase/store-schema.sql
├── test/storeApiController.test.js
├── index.js
├── package-lock.json
└── package.json
```

El servidor usa la clave `anon` (publicable), nunca la `service_role`. Configura políticas RLS para permitir solo las operaciones y usuarios que correspondan a tu aplicación. No desactives RLS ni publiques permisos de escritura sin definir quién debe acceder.

## API

Todas las rutas usan JSON. Para cada tabla se ofrece:

| Método | Ruta | Operación |
| --- | --- | --- |
| GET | `/api/{tabla}` | Listar |
| GET | `/api/{tabla}/:id` | Obtener uno |
| POST | `/api/{tabla}` | Crear |
| PUT | `/api/{tabla}/:id` | Actualizar campos enviados |
| DELETE | `/api/{tabla}/:id` | Eliminar |

Los recursos corresponden a los nombres de las tablas: `/api/empleado`, `/api/tecnico`, `/api/cliente` y `/api/servicio`.

Ejemplo de creación de empleado:

```json
{
  "nombre": "Ana Pérez",
  "cargo": "Técnica"
}
```

Los identificadores generados por la base de datos no se envían al crear registros. Los campos obligatorios, longitudes y formatos se validan antes de enviar las operaciones a Supabase.
