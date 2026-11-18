-- Venta por mostrador / para llevar: el cliente pide y paga en el mostrador, sin mesa.
-- La venta entra a la misma caja, reportes y libro diario que las mesas, y (si se elige) pasa por la barra
-- con un número de ticket del día para llamar al cliente.

-- ── Pedidos y cuentas sin mesa ──
alter table public.cuentas alter column mesa_id drop not null;
alter table public.pedidos alter column mesa_id drop not null;
alter table public.pedidos alter column numero_mesa drop not null;
alter table public.pedidos add column numero_ticket int;
alter table public.pedidos drop constraint pedidos_origen_check;
alter table public.pedidos add constraint pedidos_origen_check check (origen in ('qr', 'mozo', 'mostrador'));
-- Un pedido de mesa tiene mesa; uno de mostrador tiene ticket.
alter table public.pedidos add constraint pedidos_mesa_o_ticket check (
  (origen = 'mostrador' and mesa_id is null and numero_ticket is not null)
  or (origen <> 'mostrador' and mesa_id is not null));

-- ── Carta para el personal (misma forma que la del QR, sin mesa) ──
create or replace function public.carta_mostrador()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neg negocios;
begin
  select * into v_neg from negocios where id = public.mi_negocio();
  if not found then raise exception 'sin_permiso'; end if;
  return jsonb_build_object(
    'negocio', v_neg.nombre,
    'logo_url', v_neg.logo_url,
    'color', v_neg.color,
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre,
        'productos', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'precio', p.precio, 'foto_url', p.foto_url,
            'grupos', (
              select coalesce(jsonb_agg(jsonb_build_object(
                'id', g.id, 'nombre', g.nombre, 'minimo', pg.minimo, 'maximo', pg.maximo,
                'opciones', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nombre', o.nombre, 'precio_extra', o.precio_extra)
                              order by o.orden, o.nombre), '[]'::jsonb)
                             from opciones o where o.grupo_id = g.id and o.disponible)
              ) order by pg.orden, g.nombre), '[]'::jsonb)
              from producto_grupos pg join grupos_opciones g on g.id = pg.grupo_id
              where pg.producto_id = p.id)
          ) order by p.orden, p.nombre), '[]'::jsonb)
          from productos p
          where p.categoria_id = c.id and p.disponible
            and not exists (
              select 1 from producto_grupos pg where pg.producto_id = p.id and pg.minimo > 0
                and (select count(*) from opciones o where o.grupo_id = pg.grupo_id and o.disponible) < pg.minimo))
      ) order by c.orden, c.nombre)
      from categorias c where c.negocio_id = v_neg.id), '[]'::jsonb)
  );
end $$;

-- ── Carga los ítems de un pedido validando precio, stock y opciones (mismas reglas que crear_pedido) ──
-- p_items: [{ "producto_id": uuid, "cantidad": int, "opciones": [uuid], "nota": text }]
create or replace function public.cargar_items_pedido(p_neg uuid, p_pedido uuid, p_items jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare it jsonb; v_prod productos; v_cant int; v_ids uuid[]; v_n_ok int; v_extra numeric; v_ops jsonb; v_mal text; v_total numeric := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'pedido_vacio'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'pedido_muy_grande'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from productos where id = (it->>'producto_id')::uuid and negocio_id = p_neg;
    if not found then raise exception 'producto_invalido'; end if;
    if not v_prod.disponible then raise exception 'sin_stock:%', v_prod.nombre; end if;
    v_cant := coalesce((it->>'cantidad')::int, 1);
    if v_cant < 1 or v_cant > 50 then raise exception 'cantidad_invalida'; end if;

    select coalesce(array_agg(distinct (x #>> '{}')::uuid), '{}') into v_ids
      from jsonb_array_elements(coalesce(it->'opciones', '[]')) x;
    select count(*), coalesce(sum(o.precio_extra), 0),
           coalesce(jsonb_agg(jsonb_build_object('grupo', g.nombre, 'nombre', o.nombre, 'extra', o.precio_extra)
                              order by pg.orden, o.orden, o.nombre), '[]')
      into v_n_ok, v_extra, v_ops
      from opciones o
      join grupos_opciones g on g.id = o.grupo_id
      join producto_grupos pg on pg.grupo_id = o.grupo_id and pg.producto_id = v_prod.id
      where o.id = any(v_ids) and o.disponible;
    if v_n_ok <> coalesce(array_length(v_ids, 1), 0) then raise exception 'opcion_sin_stock'; end if;

    select g.nombre into v_mal
      from producto_grupos pg join grupos_opciones g on g.id = pg.grupo_id
      where pg.producto_id = v_prod.id
        and (select count(*) from opciones o where o.grupo_id = pg.grupo_id and o.id = any(v_ids))
            not between pg.minimo and pg.maximo
      limit 1;
    if v_mal is not null then raise exception 'opciones_invalidas:%', v_mal; end if;

    insert into items_pedido (negocio_id, pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, opciones, nota)
    values (p_neg, p_pedido, v_prod.id, v_prod.nombre, v_cant, v_prod.precio + v_extra,
            v_ops, nullif(left(trim(it->>'nota'), 200), ''));
    v_total := v_total + (v_prod.precio + v_extra) * v_cant;
  end loop;
  return v_total;
end $$;
revoke execute on function public.cargar_items_pedido(uuid, uuid, jsonb) from public, anon, authenticated;

-- ── Venta por mostrador: pedido + cobro en un paso ──
-- p_a_barra: true = la barra lo prepara (café, copa) y se llama por número; false = se entregó en el momento.
create or replace function public.venta_mostrador(p_items jsonb, p_medio text, p_a_barra boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio(); v_cuenta uuid; v_pedido uuid; v_total numeric; v_caja uuid; v_ticket int;
begin
  if v_neg is null then raise exception 'sin_permiso'; end if;
  if p_medio not in ('efectivo', 'qr', 'tarjeta') then raise exception 'medio_invalido'; end if;

  -- Número de ticket del día, sin repetir aunque dos cajas vendan a la vez.
  perform pg_advisory_xact_lock(hashtext('ticket:' || v_neg::text));
  select coalesce(max(numero_ticket), 0) + 1 into v_ticket from pedidos
    where negocio_id = v_neg and origen = 'mostrador'
      and (creado_at at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  insert into cuentas (negocio_id, mesa_id) values (v_neg, null) returning id into v_cuenta;
  insert into pedidos (negocio_id, mesa_id, cuenta_id, numero_mesa, numero_ticket, origen, estado, entregado_at)
    values (v_neg, null, v_cuenta, null, v_ticket, 'mostrador',
            case when coalesce(p_a_barra, true) then 'nuevo' else 'entregado' end,
            case when coalesce(p_a_barra, true) then null else now() end)
    returning id into v_pedido;
  v_total := public.cargar_items_pedido(v_neg, v_pedido, p_items);
  update pedidos set total = v_total where id = v_pedido;

  select id into v_caja from cajas where negocio_id = v_neg and cerrada_at is null;
  insert into pagos (negocio_id, cuenta_id, monto, medio, usuario_id, caja_id)
    values (v_neg, v_cuenta, v_total, p_medio, auth.uid(), v_caja);
  update cuentas set cerrada_at = now() where id = v_cuenta;

  return jsonb_build_object('pedido', v_pedido, 'ticket', v_ticket, 'total', v_total);
end $$;

-- ── Libro diario: las ventas de mostrador se ven como tales (antes decía "Mesa ?") ──
create or replace function public.libro_diario(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio();
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  return (
    with asientos as (
      select p.created_at as fecha, 'ingreso'::text as tipo, 'ventas'::text as categoria,
             coalesce((select case when cu.mesa_id is null
                                   then 'Mostrador' || coalesce(' · N° ' || (select pe.numero_ticket from pedidos pe where pe.cuenta_id = cu.id limit 1), '')
                                   else 'Mesa ' || m.numero end
                       from cuentas cu left join mesas m on m.id = cu.mesa_id where cu.id = p.cuenta_id), 'Venta') as concepto,
             p.monto, p.medio, 'venta'::text as origen
        from pagos p where p.negocio_id = v_neg and p.monto > 0 and p.medio <> 'fiado'
      union all
      select m.fecha, m.tipo, m.categoria, m.concepto, m.monto, m.medio, 'manual'
        from movimientos m where m.negocio_id = v_neg
    ), rango as (
      select * from asientos
      where (fecha at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
    )
    select jsonb_build_object(
      'ingresos', coalesce((select sum(monto) from rango where tipo = 'ingreso'), 0),
      'egresos', coalesce((select sum(monto) from rango where tipo = 'egreso'), 0),
      'dias', coalesce((select jsonb_agg(d order by d.dia desc) from (
        select (fecha at time zone 'America/Argentina/Buenos_Aires')::date as dia,
               sum(monto) filter (where tipo = 'ingreso') as ingresos,
               sum(monto) filter (where tipo = 'egreso') as egresos,
               jsonb_agg(jsonb_build_object('fecha', fecha, 'tipo', tipo, 'categoria', categoria, 'concepto', concepto,
                                            'monto', monto, 'medio', medio, 'origen', origen) order by fecha desc) as asientos
          from rango group by 1) d), '[]')
    )
  );
end $$;

revoke execute on function public.carta_mostrador() from public, anon;
revoke execute on function public.venta_mostrador(jsonb, text, boolean) from public, anon;
grant execute on function public.carta_mostrador() to authenticated;
grant execute on function public.venta_mostrador(jsonb, text, boolean) to authenticated;
