# Módulo administrativo (plan Premium)

## Por qué
Que el dueño del local sepa si gana o pierde plata, sin planillas aparte, y tener un plan superior para vender.

## Planes
- **Básico**: Barra, Mesas, Carta, Local y QR, Reportes.
- **Premium**: lo anterior + sección **Administración**.
- Lo cambia solo la administradora de la plataforma desde "Mis locales". En Básico, Administración aparece con candado ("Disponible en Premium").
- Dentro del local, Administración la ve solo el rol dueño.

## Contenido de Administración
1. **Caja**: apertura con efectivo inicial; los cobros de Mesas entran solos por medio de pago; ingresos y egresos manuales; cierre con efectivo contado vs esperado y diferencia.
2. **Libro diario**: todo lo que entró y salió por día, armado desde ventas, movimientos de caja, gastos pagados, pagos a proveedores, cobros de deudas y sueldos.
3. **Cuentas por cobrar**: deudores con monto, fecha, concepto y pagos parciales. Medio de pago "Fiado" al cerrar una mesa crea la deuda.
4. **Cuentas por pagar / gastos**: alquiler, luz, gas, impuestos, sueldos, proveedores, otros; vencimiento; pagado/pendiente; gastos fijos que se repiten cada mes.
5. **Empleados**: ficha con puesto y sueldo; **comisión configurable por empleado** (tipo: % de lo que cobró, % de ventas totales, monto fijo o ninguna; valor editable). La liquidación mensual crea la cuenta por pagar.
6. **Proveedores**: qué provee y a qué costo, plazo de pago en días, compras, saldo adeudado, último pedido y último pago. Cada compra crea su cuenta por pagar con vencimiento según el plazo.
7. **Precios y márgenes**: costo por producto (carga manual), precio de venta, margen y aviso de margen bajo.
8. **Resultado del mes**: ingresos menos gastos, por rubro, comparado con el mes anterior.

## Etapas
1. Plan Premium + Caja + Libro diario.
2. Cuentas por pagar + Proveedores.
3. Cuentas por cobrar (Fiado).
4. Empleados y sueldos.
5. Precios y márgenes + Resultado.

## Fuera de alcance
Facturación electrónica, contabilidad formal, costeo por receta.

## Decisiones tomadas por el equipo de desarrollo
- La caja la opera el dueño (el rol "mozo" no entra a Administración). Revisar si los locales piden un rol "cajero".
- Una sola caja abierta por local a la vez (sin cajas por turno simultáneas).
- Un cobro de mesa hecho sin caja abierta igual se registra como venta y aparece en el libro diario, pero no en ninguna caja.
