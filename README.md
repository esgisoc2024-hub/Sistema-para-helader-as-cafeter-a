# Mesa Match — sistema para heladerías-cafetería

Pedidos en mesa por QR, comandas en la barra en tiempo real, mapa de mesas con cobro y reportes de ventas y espera.
Resuelve los dolores relevados en reseñas: demora en mesa, faltantes que siguen en la carta, errores al cobrar y decisiones sin datos.

## Qué incluye (versión 1)

| Pantalla | Ruta | Rol |
|---|---|---|
| Carta por QR + carrito + opciones (sabores, leche, tamaño, extras) | `/m/<codigo-de-mesa>` | Cliente (sin cuenta) |
| Estado del pedido, llamar al mozo, pedir la cuenta | misma pantalla, pestaña “Mi pedido” | Cliente |
| Mostrador / para llevar: armar la venta, cobrar (con vuelto) y número de ticket del día | `/panel/mostrador` | Barra, mozo, dueño |
| Comandas de barra (tiempo real, aviso sonoro, alerta a los 10 min) + “sin stock” | `/panel/barra` | Barra, mozo, dueño |
| Mapa de mesas, detalle, cargar pedido a mano, cobrar y cerrar | `/panel/mesas` | Mozo, dueño |
| Carta: categorías, productos, precios y listas de opciones por producto | `/panel/carta` | Dueño |
| Apariencia (nombre, portada con foto o video, logo, color), mesas, QR para imprimir y equipo | `/panel/local` | Dueño |
| Reportes: cobrado, pedidos, espera promedio y máxima, ranking de productos y de cada lista de opciones | `/panel/reportes` | Dueño |

**Plan Premium → Administración** (`/panel/administracion`, solo el dueño de un local Premium): caja con apertura, movimientos y cierre con diferencia; libro diario por día; cuentas por pagar con gastos fijos mensuales y pagos parciales; proveedores con artículos, costos, plazo de pago y deuda; cuentas por cobrar con clientes, deudas, cobros y "Fiado" al cerrar una mesa; empleados con comisión configurable y liquidación mensual que pasa a cuentas por pagar; precios, costos y márgenes con historial de precios; resultado del mes comparado con el anterior. Diseño completo y próximas etapas en `docs/superpowers/specs/2026-11-17-modulo-administrativo-design.md`.

**Panel de la plataforma** (`/admin`, solo cuentas en la tabla `administradores`): lista de todos los locales con su actividad, estado (prueba, activo, suspendido), pago y notas privadas. Un local suspendido deja de recibir pedidos por QR.

Fuera de la v1: facturación electrónica ARCA, cobro online en el QR, stock de insumos por receta, delivery y reservas.

## Cómo funciona

- **Next.js 15** (App Router) + **Tailwind 4**, todo en el navegador; se publica en **Vercel**.
- **Supabase**: Postgres con RLS por negocio, Auth para el personal y Realtime para la barra y las mesas.
- El cliente no tiene cuenta: solo usa funciones SQL acotadas (`carta_mesa`, `crear_pedido`, `estado_mesa`, `llamar_desde_mesa`) que validan precio, stock y sabores en el servidor. El precio se copia a cada ítem al pedir.
- **Opciones por producto**: el dueño arma listas reutilizables (Sabores, Leche, Tamaño, Extras) con precio extra opcional, y en cada producto marca cuáles usa, si son obligatorias y cuántas se eligen. Marcar una opción "sin stock" la saca de todos los productos; si un producto se queda sin opciones obligatorias, se oculta solo.
- Una **cuenta** es la visita de un grupo a una mesa: se abre con el primer pedido y se cierra al cobrar, así la mesa siguiente arranca de cero.
- Una **venta de mostrador** (`venta_mostrador`) crea el pedido y lo cobra en un solo paso: la cuenta no tiene mesa y se cierra en el momento, el pago entra a la caja abierta y a los reportes, y el pedido lleva un número de ticket que se reinicia cada día. Si “Lo prepara la barra” está activo, aparece en las comandas como “Mostrador · N° 12”; si no, queda como entregado.
- El dueño crea el negocio (opcionalmente con carta de ejemplo y 8 mesas) y comparte un **código de equipo**; quien se une entra como mozo y el dueño le cambia el rol.

## Puesta en marcha

1. Crear un proyecto en Supabase y correr, en orden, los archivos de `supabase/migrations/`
   (SQL Editor, o `supabase db push` con la CLI). El último crea el almacenamiento de imágenes.
2. En Supabase → Authentication, para probar rápido se puede desactivar “Confirm email”.
3. La URL y la publishable key del proyecto actual ya están en `src/lib/supabase.ts` (son públicas). Para usar otro proyecto, copiar `.env.example` a `.env.local`.
4. `npm install` y `npm run dev` → http://localhost:3000
5. Crear cuenta → “Soy el dueño” → imprimir los QR desde **Local y QR**.

Para Vercel: importar el repo (las variables son opcionales). En Supabase → Authentication → URL Configuration, poner el link de Vercel en Site URL.

## Pruebas de la base de datos

`supabase/tests/flujo.sql` recorre el flujo completo (alta, pedido por QR, barra, sin stock, cobro, reporte, aislamiento entre negocios y permisos de roles) sobre un Postgres común:

```bash
createdb prueba && psql -d prueba -f supabase/tests/stub_supabase.sql \
  -f supabase/migrations/20261116000000_esquema_inicial.sql -f supabase/tests/flujo.sql
```

Termina con `TODO OK`. La venta por mostrador tiene su propia prueba, que corre sobre todas las migraciones:

```bash
createdb mostrador && psql -d mostrador -f supabase/tests/stub_supabase.sql \
  $(for f in supabase/migrations/*.sql; do echo -f $f; done) -f supabase/tests/mostrador.sql
```

Termina con `MOSTRADOR OK` (los errores de `storage` son esperables: el stub no simula el almacenamiento de imágenes).
