-- Prueba de punta a punta: alta de negocio, pedido por QR, barra, cobro, reporte y aislamiento entre negocios.
\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c');

-- Dueña A crea su negocio con carta de ejemplo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.crear_negocio('Heladería A', 'Gise', true) is not null as negocio_creado;
select count(*) = 8 as ocho_mesas from mesas;
-- Dueño B crea otro negocio
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.crear_negocio('Heladería B', 'Beto', false) is not null;
select count(*) = 0 as b_no_ve_mesas_de_a from mesas;
reset role;
select codigo as mesa1 from mesas m join negocios n on n.id = m.negocio_id where n.nombre = 'Heladería A' and numero = 1 \gset
select id as vasito from productos where nombre = 'Vasito 1/4 kg' \gset
select id as cafe from productos where nombre = 'Café con leche' \gset
select id as ddl from opciones where nombre = 'Dulce de leche' \gset
select id as choco from opciones where nombre = 'Chocolate' \gset
select id as grande from opciones where nombre = 'Grande' \gset
select id as chico from opciones where nombre = 'Chico' \gset
select id as almendra from opciones where nombre = 'De almendras' \gset
select o.id as banana, l.id as entera from opciones o, opciones l where o.nombre = 'Banana' and l.nombre = 'Entera' \gset

-- Cliente anónimo escanea y pide
set role anon; reset request.jwt.claim.sub;
select (public.carta_mesa(:'mesa1')->>'mesa')::int = 1 as carta_ok;
-- Vasito con 2 sabores + 2 cafés con leche grandes de almendras: 6000 + 2 * (3300 + 900 + 700)
select public.crear_pedido(:'mesa1', jsonb_build_array(
  jsonb_build_object('producto_id', :'vasito', 'cantidad', 1, 'opciones', jsonb_build_array(:'ddl', :'choco')),
  jsonb_build_object('producto_id', :'cafe', 'cantidad', 2, 'opciones', jsonb_build_array(:'grande', :'almendra'), 'nota', 'uno cortado'))) as pedido \gset
select (public.estado_mesa(:'mesa1')->>'total')::numeric = 15800 as total_ok;
select jsonb_array_length(opciones) = 2 and precio_unitario = 4900 as extras_copiados from items_pedido where nombre_producto = 'Café con leche';
select count(*) = 0 as anon_no_lee_tablas from pedidos;

-- Errores esperados: mesa inexistente, falta elegir leche (obligatorio), dos tamaños (máximo 1), opción de otro producto
create function pg_temp.falla(q text) returns boolean language plpgsql as $f$
begin execute q; return false; exception when others then return true; end $f$;
select pg_temp.falla($q$ select public.crear_pedido('no-existe', '[]') $q$) as mesa_invalida_falla;
select pg_temp.falla(format($q$ select public.crear_pedido(%L, '[{"producto_id":"%s","opciones":["%s"]}]') $q$, :'mesa1', :'cafe', :'grande')) as falta_leche_falla;
select pg_temp.falla(format($q$ select public.crear_pedido(%L, '[{"producto_id":"%s","opciones":["%s","%s","%s"]}]') $q$, :'mesa1', :'cafe', :'grande', :'chico', :'almendra')) as dos_tamanios_falla;
select pg_temp.falla(format($q$ select public.crear_pedido(%L, '[{"producto_id":"%s","opciones":["%s","%s","%s"]}]') $q$, :'mesa1', :'cafe', :'grande', :'almendra', :'ddl')) as opcion_ajena_falla;
select (public.estado_mesa(:'mesa1')->>'total')::numeric = 15800 as fallidos_no_suman;

-- Barra (dueña A) cambia estado y marca sin stock
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update pedidos set estado = 'preparando' where id = :'pedido';
update pedidos set estado = 'listo' where id = :'pedido';
select listo_at is not null and preparando_at is not null as horas_ok from pedidos where id = :'pedido';
select public.cambiar_disponible('opcion', :'choco', false);
-- Sin ninguna fruta, el licuado (fruta obligatoria) desaparece de la carta
update opciones set disponible = false where grupo_id = (select grupo_id from opciones where id = :'banana');
reset role;
set role anon; reset request.jwt.claim.sub;
select not (public.carta_mesa(:'mesa1')::text like '%"Chocolate"%') as choco_oculto;
select not (public.carta_mesa(:'mesa1')::text like '%Licuado%') as licuado_oculto;
select public.carta_mesa(:'mesa1')::text like '%Cucurucho%' as cucurucho_visible;
select public.llamar_desde_mesa(:'mesa1', 'cuenta');
select public.estado_mesa(:'mesa1')->>'estado_mesa' = 'pide_cuenta' as pide_cuenta;

-- Dueño B no puede tocar pedidos de A
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update pedidos set estado = 'cancelado' where id = :'pedido';
reset role; select estado = 'listo' as b_no_modifico from pedidos where id = :'pedido';

-- Cierre de mesa por A y reporte
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.cerrar_mesa((select id from mesas where codigo = :'mesa1'), 'efectivo') = 15800 as cobro_ok;
select estado = 'libre' as mesa_libre from mesas where codigo = :'mesa1';
select (r->>'ventas')::numeric = 15800 as ventas_ok, jsonb_array_length(r->'opciones') = 4 as opciones_ok
  from public.reporte(now() - interval '1 day', now() + interval '1 day') r;
-- Nueva visita en la misma mesa arranca de cero
reset role; set role anon; reset request.jwt.claim.sub;
select (public.estado_mesa(:'mesa1')->>'total')::numeric = 0 as nueva_visita_limpia;
-- Un mozo que se une no puede ver reportes
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
reset role;
select codigo_equipo as cod from negocios where nombre = 'Heladería A' \gset
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.unirse_a_negocio(:'cod', 'Mozo Juan') is not null as mozo_unido;
do $$ begin perform public.reporte(now(), now()); raise exception 'debio fallar'; exception when others then if sqlerrm = 'debio fallar' then raise; end if; end $$;
-- Apariencia: la dueña cambia color y logo; el cliente los ve; un color inválido se rechaza; el mozo no puede cambiarlo.
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update negocios set color = '#1f6feb', logo_url = 'https://ejemplo.com/logo.webp';
select pg_temp.falla($q$ update negocios set color = 'rojo' $q$) as color_invalido_falla;
reset role; set role anon; reset request.jwt.claim.sub;
select public.carta_mesa(:'mesa1')->>'color' = '#1f6feb' and public.carta_mesa(:'mesa1')->>'logo_url' like '%logo.webp' as cliente_ve_marca;
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
update negocios set color = '#000000';
reset role; select color = '#1f6feb' as mozo_no_cambia_color from negocios where nombre = 'Heladería A';
-- Panel de administración: solo la administradora ve todos los locales y puede suspender.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ad', 'admin@ejemplo.com');
insert into administradores (user_id) values ('00000000-0000-0000-0000-0000000000ad');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select not public.es_admin() as duenia_no_es_admin;
select pg_temp.falla($q$ select public.admin_locales() $q$) as duenia_no_ve_locales;
select pg_temp.falla($q$ update negocios set estado = 'activo' $q$) as duenia_no_cambia_estado;
select count(*) = 0 as duenia_no_lee_seguimiento from admin_seguimiento;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select jsonb_array_length(public.admin_locales()) = 2 as admin_ve_los_dos;
select (l->>'pedidos_30d')::int >= 1 and (l->>'ventas_30d')::numeric = 15800 as actividad_ok
  from jsonb_array_elements(public.admin_locales()) l where l->>'nombre' = 'Heladería A';
reset role; select id as neg_a from negocios where nombre = 'Heladería A' \gset
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select public.admin_actualizar_local(:'neg_a', 'suspendido', '11-5555-0000', '2026-12-10', 'No pagó noviembre');
reset role; set role anon; reset request.jwt.claim.sub;
select (public.carta_mesa(:'mesa1')->>'suspendido')::boolean as carta_suspendida;
select pg_temp.falla(format($q$ select public.crear_pedido(%L, '[{"producto_id":"%s","opciones":["%s","%s"]}]') $q$, :'mesa1', :'cafe', :'grande', :'almendra')) as suspendido_no_pide;
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select public.admin_actualizar_local(:'neg_a', 'activo', '11-5555-0000', '2026-12-10', null);
reset role; set role anon; reset request.jwt.claim.sub;
select public.carta_mesa(:'mesa1') ? 'categorias' as reactivado_ok;
-- ── Etapa 1 Premium: caja y libro diario ──
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.falla($q$ select public.abrir_caja(10000) $q$) as basico_no_abre_caja;
select pg_temp.falla($q$ update negocios set plan = 'premium' $q$) as duenia_no_se_pone_premium;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select public.admin_actualizar_local(:'neg_a', 'activo', null, null, null, 'premium');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.abrir_caja(10000) is not null as caja_abierta;
select pg_temp.falla($q$ select public.abrir_caja(5000) $q$) as no_dos_cajas;
-- una mesa cobrada en efectivo entra sola a la caja
reset role; set role anon; reset request.jwt.claim.sub;
select public.crear_pedido(:'mesa1', jsonb_build_array(jsonb_build_object('producto_id', :'vasito', 'cantidad', 2, 'opciones', jsonb_build_array(:'ddl')))) is not null;
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.cerrar_mesa((select id from mesas where codigo = :'mesa1'), 'efectivo') = 12000 as mesa_cobrada;
select public.registrar_movimiento('egreso', 'Hielo', 1500) is not null;
select public.registrar_movimiento('ingreso', 'Torta por encargo', 8000, 'transferencia', 'otros ingresos') is not null;
select (r->>'efectivo_esperado')::numeric = 10000 + 12000 - 1500 as esperado_ok,
       (r->>'ventas_total')::numeric = 12000 as ventas_ok, jsonb_array_length(r->'movimientos') = 2 as movs_ok
  from public.resumen_caja() r;
select (r->>'efectivo_contado')::numeric - (r->>'efectivo_esperado')::numeric = -500 as cierre_falta_500
  from public.cerrar_caja(20000, 'faltaron 500') r;
select jsonb_array_length(public.historial_cajas()) = 1 as historial_ok;
select pg_temp.falla(format($q$ select public.borrar_movimiento(%L) $q$, (select id from movimientos where concepto = 'Hielo'))) as no_borra_caja_cerrada;
select (l->>'ingresos')::numeric = 15800 + 12000 + 8000 and (l->>'egresos')::numeric = 1500 as libro_ok
  from public.libro_diario(current_date - 1, current_date + 1) l;
-- otro local no ve la caja; el mozo tampoco
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select count(*) = 0 as otro_no_ve_cajas from cajas;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.falla($q$ select public.resumen_caja() $q$) as mozo_no_ve_caja;
-- ── Etapa 2: proveedores, gastos y gastos fijos ──
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into proveedores (negocio_id, nombre, plazo_dias) values (:'neg_a', 'Lácteos del Oeste', 15);
select id as prov from proveedores where nombre = 'Lácteos del Oeste' \gset
insert into proveedor_items (negocio_id, proveedor_id, nombre, unidad, costo) values (:'neg_a', :'prov', 'Leche entera', 'litro', 1200);
insert into gastos (negocio_id, categoria, concepto, monto, fecha, proveedor_id) values (:'neg_a', 'proveedores', 'Pedido semanal', 50000, current_date - 20, :'prov');
select vence = current_date - 5 as vence_por_plazo from gastos where concepto = 'Pedido semanal';
select id as compra from gastos where concepto = 'Pedido semanal' \gset
select pg_temp.falla(format($q$ select public.pagar_gasto(%L, 60000) $q$, :'compra')) as no_paga_de_mas;
select public.abrir_caja(1000) is not null as caja2;
select public.pagar_gasto(:'compra', 20000, 'efectivo') is not null as pago_parcial;
select (x->>'estado') = 'vencido' and (x->>'saldo')::numeric = 30000 as cuenta_vencida
  from jsonb_array_elements(public.cuentas_por_pagar()) x where x->>'concepto' = 'Pedido semanal';
select (x->>'deuda')::numeric = 30000 and x->>'ultimo_pago' is not null and jsonb_array_length(x->'items') = 1 as proveedor_ok
  from jsonb_array_elements(public.resumen_proveedores()) x;
select (r->>'efectivo_esperado')::numeric = 1000 - 20000 as caja_descuenta_pago from public.resumen_caja() r;
select pg_temp.falla(format($q$ delete from gastos where id = %L $q$, :'compra')) as no_borra_gasto_con_pagos;
-- gasto fijo: se genera una sola vez por mes
insert into gastos_fijos (negocio_id, categoria, concepto, monto, dia_vencimiento) values (:'neg_a', 'alquiler', 'Alquiler del local', 400000, 10);
select public.generar_gastos_fijos() = 1 as fijo_generado;
select public.generar_gastos_fijos() = 0 as fijo_no_duplica;
select (l->>'egresos')::numeric = 1500 + 20000 as libro_incluye_pago
  from public.libro_diario(current_date - 1, current_date + 1) l;
-- aislamiento
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select count(*) = 0 as otro_no_ve_proveedores from proveedores;
select pg_temp.falla(format($q$ select public.pagar_gasto(%L, 1) $q$, :'compra')) as otro_no_paga;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) = 0 as mozo_no_ve_gastos from gastos;
reset role;
select 'TODO OK' as resultado;
