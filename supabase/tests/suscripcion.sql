-- Prueba gratis, gracia, vencimiento, Mercado Pago y avisos.
-- Corre sola sobre todas las migraciones:
--   psql -d prueba -f supabase/tests/stub_supabase.sql -f supabase/migrations/<todas, en orden> -f supabase/tests/suscripcion.sql
\set ON_ERROR_STOP 1
create function pg_temp.ok(cond boolean, nombre text) returns text language plpgsql as $f$
begin if cond is not true then raise exception 'FALLÓ: %', nombre; end if; return 'ok: ' || nombre; end $f$;
create function pg_temp.falla(q text) returns boolean language plpgsql as $f$
begin execute q; return false; exception when others then return true; end $f$;

insert into auth.users values ('00000000-0000-0000-0000-0000000000e1', 'duenia@local.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'admin@plataforma.com'), ('00000000-0000-0000-0000-0000000000e3', 'otro@local.com');
insert into administradores values ('00000000-0000-0000-0000-0000000000e2');

-- La dueña se registra pidiendo Premium: arranca con 14 días de prueba y prueba Premium
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.crear_negocio('Heladería Prueba', 'Gise', true, '1155555555', 'premium') as neg \gset
select pg_temp.ok((public.mi_suscripcion()->>'situacion') = 'prueba', 'arranca en prueba');
select pg_temp.ok((public.mi_suscripcion()->>'dias_restantes')::int = 14, 'catorce dias de prueba');
select pg_temp.ok((public.mi_suscripcion()->>'plan_vigente') = 'premium', 'prueba el plan que pidio');
select pg_temp.ok(public.puede_administrar(), 'usa administracion en la prueba');
select pg_temp.ok(public.abrir_caja(1000) is not null, 'abre caja en la prueba');
select pg_temp.ok((public.mi_suscripcion()->'precios'->>'basico')::numeric = 29900, 'precio basico');
-- El dueño no puede cambiarse la fecha de prueba ni el estado
select pg_temp.ok(pg_temp.falla($q$ update negocios set prueba_hasta = current_date + 300 $q$), 'duenio no extiende su prueba');
select pg_temp.ok(pg_temp.falla($q$ select public.mp_sincronizar('x', 'authorized', current_date + 30) $q$), 'duenio no simula pago');
select pg_temp.ok(pg_temp.falla($q$ select public.avisos_pendientes() $q$), 'duenio no lee avisos');

set role anon; reset request.jwt.claim.sub;
select pg_temp.ok((public.config_publica()->>'dias_prueba')::int = 14, 'config publica');
reset role;
select codigo as mesa1 from mesas where negocio_id = :'neg' and numero = 1 \gset
select id as vasito from productos where nombre = 'Medialunas x2' and negocio_id = :'neg' \gset

-- Faltan 2 días: se arma el aviso "por vencer"
update negocios set prueba_hasta = public.hoy_ar() + 2 where id = :'neg';
select pg_temp.ok(public.avisos_pendientes()::text like '%por_vencer%', 'aviso por vencer');
select pg_temp.ok((select count(*) from avisos where tipo = 'por_vencer') = 1, 'un solo aviso por vencer');
select public.avisos_pendientes() is not null; -- correrlo dos veces no duplica
select pg_temp.ok((select count(*) from avisos where tipo = 'por_vencer') = 1, 'no duplica avisos');

-- Venció ayer: está en gracia, la carta sigue andando, y se avisa al cliente y a la administradora
update negocios set prueba_hasta = public.hoy_ar() - 1 where id = :'neg';
select pg_temp.ok(public.situacion_local(:'neg') = 'gracia', 'gracia al vencer');
select pg_temp.ok(public.avisos_pendientes()::text like '%vencio_admin%', 'aviso a la administradora');
select pg_temp.ok((select count(*) from avisos where tipo in ('vencio', 'vencio_admin')) = 2, 'aviso al cliente y a la admin');
set role anon;
select pg_temp.ok(public.carta_mesa(:'mesa1') ? 'categorias', 'carta anda en la gracia');
reset role;

-- Pasaron los 2 días de gracia: la carta se pausa, no entran pedidos y se corta Premium
update negocios set prueba_hasta = public.hoy_ar() - 3 where id = :'neg';
select pg_temp.ok(public.situacion_local(:'neg') = 'vencida', 'vencida despues de la gracia');
set role anon;
select pg_temp.ok((public.carta_mesa(:'mesa1')->>'suspendido')::boolean, 'carta pausada');
select pg_temp.ok(pg_temp.falla(format($q$ select public.crear_pedido(%L, '[{"producto_id":"%s"}]') $q$, :'mesa1', :'vasito')), 'no entran pedidos');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.ok(not public.puede_administrar(), 'sin administracion vencida');
select pg_temp.ok((public.mi_suscripcion()->>'situacion') = 'vencida', 'el duenio ve vencida');

-- La administradora le extiende la prueba 7 días
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select pg_temp.ok(public.admin_extender_prueba(:'neg', 7) = public.hoy_ar() + 7, 'extender prueba');
select pg_temp.ok((select (x->>'situacion') from jsonb_array_elements(public.admin_locales()) x where x->>'id' = :'neg') = 'prueba', 'admin ve situacion');
select public.admin_guardar_config(7, 2, 29900, 59900, 'avisos@plataforma.com');
select pg_temp.ok((public.admin_config()->>'dias_prueba')::int = 7, 'guarda config');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.ok(pg_temp.falla($q$ select public.admin_extender_prueba(mi_negocio(), 30) $q$), 'duenio no usa admin');
select pg_temp.ok(pg_temp.falla($q$ select public.admin_guardar_config(90, 30, 1, 1, 'x') $q$), 'duenio no cambia config');

-- Un local nuevo toma los días nuevos (7)
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select public.crear_negocio('Otro Local', 'Otro', false) as otro \gset
select pg_temp.ok((public.mi_suscripcion()->>'dias_restantes')::int = 7, 'local nuevo con 7 dias');
reset role;

-- Se suscribe a Premium con Mercado Pago y el pago se aprueba: queda activo hasta el próximo cobro
select public.mp_registrar_suscripcion(:'neg', 'pre_123', 'premium', 'duenia@local.com');
select pg_temp.ok(public.mp_sincronizar('pre_123', 'authorized', public.hoy_ar() + 30) ->> 'nuevo_pago' = 'true', 'pago aprobado');
select pg_temp.ok((select estado = 'activo' and plan = 'premium' from negocios where id = :'neg'), 'activo y premium');
select pg_temp.ok((select pagado_hasta = public.hoy_ar() + 30 from admin_seguimiento where negocio_id = :'neg'), 'pagado hasta proximo cobro');
select pg_temp.ok(public.situacion_local(:'neg') = 'activo', 'situacion activo');
select pg_temp.ok((select count(*) from avisos where tipo = 'pago_admin') = 1, 'aviso de pago a la admin');
-- El mismo aviso de Mercado Pago repetido no duplica nada
select public.mp_sincronizar('pre_123', 'authorized', public.hoy_ar() + 30);
select pg_temp.ok((select count(*) from avisos where tipo = 'pago_admin') = 1, 'webhook repetido no duplica');

-- Cancela: sigue activo hasta lo pagado; después del cobro fallido y la gracia, queda vencida
select public.mp_sincronizar('pre_123', 'cancelled', null);
select pg_temp.ok(public.situacion_local(:'neg') = 'activo', 'cancelada sigue hasta lo pagado');
select pg_temp.ok((select count(*) from avisos where tipo = 'baja_admin') = 1, 'aviso de baja');
update admin_seguimiento set pagado_hasta = public.hoy_ar() - 1 where negocio_id = :'neg';
select pg_temp.ok(public.situacion_local(:'neg') = 'gracia', 'pago vencido en gracia');
update admin_seguimiento set pagado_hasta = public.hoy_ar() - 5 where negocio_id = :'neg';
select pg_temp.ok(public.situacion_local(:'neg') = 'vencida', 'pago vencido despues de la gracia');

-- Un local activo cobrado a mano (sin Mercado Pago) no se vence solo
update negocios set estado = 'activo' where id = :'otro';
select pg_temp.ok(public.situacion_local(:'otro') = 'activo', 'activo manual no vence');

select 'SUSCRIPCION OK' as resultado;
