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
select id as cafe from productos where nombre = 'Café' \gset
select id as ddl from sabores where nombre = 'Dulce de leche' \gset
select id as choco from sabores where nombre = 'Chocolate' \gset

-- Cliente anónimo escanea y pide
set role anon; reset request.jwt.claim.sub;
select (public.carta_mesa(:'mesa1')->>'mesa')::int = 1 as carta_ok;
select public.crear_pedido(:'mesa1', jsonb_build_array(
  jsonb_build_object('producto_id', :'vasito', 'cantidad', 1, 'sabores', jsonb_build_array(:'ddl', :'choco')),
  jsonb_build_object('producto_id', :'cafe', 'cantidad', 2, 'nota', 'uno cortado'))) as pedido \gset
select (public.estado_mesa(:'mesa1')->>'total')::numeric = 6000 + 2*2800 as total_ok;
select count(*) = 0 as anon_no_lee_tablas from pedidos;

-- Errores esperados
do $$ begin perform public.crear_pedido('no-existe', '[]'); raise exception 'debio fallar'; exception when others then if sqlerrm = 'debio fallar' then raise; end if; end $$;

-- Barra (dueña A) cambia estado y marca sin stock
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update pedidos set estado = 'preparando' where id = :'pedido';
update pedidos set estado = 'listo' where id = :'pedido';
select listo_at is not null and preparando_at is not null as horas_ok from pedidos where id = :'pedido';
select public.cambiar_disponible('sabor', :'choco', false);
reset role;
set role anon; reset request.jwt.claim.sub;
select not (public.carta_mesa(:'mesa1')->'sabores' @> jsonb_build_array(jsonb_build_object('nombre','Chocolate'))) as choco_oculto;
select public.llamar_desde_mesa(:'mesa1', 'cuenta');
select public.estado_mesa(:'mesa1')->>'estado_mesa' = 'pide_cuenta' as pide_cuenta;

-- Dueño B no puede tocar pedidos de A
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
update pedidos set estado = 'cancelado' where id = :'pedido';
reset role; select estado = 'listo' as b_no_modifico from pedidos where id = :'pedido';

-- Cierre de mesa por A y reporte
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.cerrar_mesa((select id from mesas where codigo = :'mesa1'), 'efectivo') = 11600 as cobro_ok;
select estado = 'libre' as mesa_libre from mesas where codigo = :'mesa1';
select (r->>'ventas')::numeric = 11600 as ventas_ok, jsonb_array_length(r->'sabores') = 2 as sabores_ok
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
select 'TODO OK' as resultado;
