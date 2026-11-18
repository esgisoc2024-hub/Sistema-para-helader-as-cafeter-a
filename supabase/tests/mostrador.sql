-- Venta por mostrador: pedido + cobro en un paso, ticket del día, barra, caja, reporte y libro diario.
-- Corre sola sobre las migraciones (no necesita flujo.sql):
--   psql -d prueba -f supabase/tests/stub_supabase.sql -f supabase/migrations/<todas, en orden> -f supabase/tests/mostrador.sql
\set ON_ERROR_STOP 1
create function pg_temp.falla(q text) returns boolean language plpgsql as $f$
begin execute q; return false; exception when others then return true; end $f$;

insert into auth.users values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2'), ('00000000-0000-0000-0000-0000000000d3');

-- Dueña con carta de ejemplo; una persona de barra se suma con el código
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.crear_negocio('Heladería Mostrador', 'Gise', true) as neg \gset
select codigo_equipo as cod from negocios \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select public.unirse_a_negocio(:'cod', 'Cajera Ana') is not null;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
update usuarios set rol = 'barra' where id = '00000000-0000-0000-0000-0000000000d2';
-- Otro local
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d3';
select public.crear_negocio('Otra Heladería', 'Otro', false) is not null;

reset role;
select id as vasito from productos where nombre = 'Vasito 1/4 kg' and negocio_id = :'neg' \gset
select id as medialunas from productos where nombre = 'Medialunas x2' and negocio_id = :'neg' \gset
select id as ddl from opciones where nombre = 'Dulce de leche' and negocio_id = :'neg' \gset
select id as limon from opciones where nombre = 'Limón' and negocio_id = :'neg' \gset

-- La carta del mostrador tiene la misma forma que la del QR y no la ve un anónimo
set role anon; reset request.jwt.claim.sub;
select pg_temp.falla($q$ select public.carta_mostrador() $q$) as anon_sin_carta_mostrador;
select pg_temp.falla($q$ select public.venta_mostrador('[]', 'efectivo') $q$) as anon_no_vende;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select public.carta_mostrador()->>'negocio' = 'Heladería Mostrador'
       and public.carta_mostrador()::text like '%Vasito 1/4 kg%' as carta_mostrador_ok;

-- 1) La de barra vende un vasito de 2 sabores en efectivo; pasa por la barra con ticket 1
select public.venta_mostrador(jsonb_build_array(
  jsonb_build_object('producto_id', :'vasito', 'cantidad', 1, 'opciones', jsonb_build_array(:'ddl', :'limon'))), 'efectivo', true) as v1 \gset
select (:'v1'::jsonb->>'ticket')::int = 1 and (:'v1'::jsonb->>'total')::numeric = 6000 as ticket_1;
select estado = 'nuevo' and origen = 'mostrador' and mesa_id is null and numero_mesa is null as en_barra
  from pedidos where id = (:'v1'::jsonb->>'pedido')::uuid;
select cerrada_at is not null as cuenta_cerrada from cuentas where id = (select cuenta_id from pedidos where id = (:'v1'::jsonb->>'pedido')::uuid);
-- 2) Medialunas x3 con QR, entregadas en el momento: ticket 2, no llegan a la barra
select public.venta_mostrador(jsonb_build_array(
  jsonb_build_object('producto_id', :'medialunas', 'cantidad', 3)), 'qr', false) as v2 \gset
select (:'v2'::jsonb->>'ticket')::int = 2 and (:'v2'::jsonb->>'total')::numeric = 7200 as ticket_2;
select estado = 'entregado' and entregado_at is not null as entregado_al_toque from pedidos where id = (:'v2'::jsonb->>'pedido')::uuid;
select count(*) = 1 as barra_ve_solo_el_primero from pedidos where estado in ('nuevo', 'preparando', 'listo');

-- La barra lo avanza como cualquier comanda
update pedidos set estado = 'listo' where id = (:'v1'::jsonb->>'pedido')::uuid;
select listo_at is not null as listo_ok from pedidos where id = (:'v1'::jsonb->>'pedido')::uuid;

-- Errores esperados: vacío, faltan sabores, medio inválido, fiado no se acepta en mostrador, producto de otro local
select pg_temp.falla($q$ select public.venta_mostrador('[]', 'efectivo') $q$) as vacio_falla;
select pg_temp.falla(format($q$ select public.venta_mostrador('[{"producto_id":"%s"}]', 'efectivo') $q$, :'vasito')) as faltan_sabores_falla;
select pg_temp.falla(format($q$ select public.venta_mostrador('[{"producto_id":"%s"}]', 'cheque') $q$, :'medialunas')) as medio_invalido_falla;
select pg_temp.falla(format($q$ select public.venta_mostrador('[{"producto_id":"%s"}]', 'fiado') $q$, :'medialunas')) as fiado_falla;
-- Sin stock: se agota el limón y ya no se puede vender
select public.cambiar_disponible('opcion', :'limon', false);
select pg_temp.falla(format($q$ select public.venta_mostrador('[{"producto_id":"%s","opciones":["%s","%s"]}]', 'efectivo') $q$, :'vasito', :'ddl', :'limon')) as sin_stock_falla;
select count(*) = 2 as fallidos_no_dejan_rastro from pagos;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d3';
select pg_temp.falla(format($q$ select public.venta_mostrador('[{"producto_id":"%s"}]', 'efectivo') $q$, :'medialunas')) as otro_local_falla;
select count(*) = 0 as otro_local_no_ve_ventas from pedidos;

-- Reporte de la dueña: las ventas de mostrador suman
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select (r->>'ventas')::numeric = 13200 and (r->'por_medio'->>'qr')::numeric = 7200 as reporte_ok
  from public.reporte(now() - interval '1 hour', now() + interval '1 hour') r;

-- Premium: la venta entra a la caja abierta y al libro diario como "Mostrador · N° x"
reset role;
update negocios set plan = 'premium' where id = :'neg';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.abrir_caja(5000) is not null as caja_abierta;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select public.venta_mostrador(jsonb_build_array(jsonb_build_object('producto_id', :'medialunas', 'cantidad', 1)), 'efectivo', false) as v3 \gset
select (:'v3'::jsonb->>'ticket')::int = 3 as ticket_3;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select (public.resumen_caja()->'ventas'->>'efectivo')::numeric = 2400 as caja_suma_mostrador;
select public.libro_diario(current_date - 1, current_date + 1)::text like '%Mostrador · N° 3%' as libro_dice_mostrador;

reset role;
select 'MOSTRADOR OK' as resultado;
