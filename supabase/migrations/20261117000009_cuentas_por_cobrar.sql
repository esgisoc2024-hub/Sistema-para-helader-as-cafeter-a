-- Etapa 3 del módulo administrativo: cuentas por cobrar (clientes que deben) y "Fiado" al cerrar una mesa.
-- Cada cobro es un movimiento de ingreso: entra a la caja (si es en efectivo) y al libro diario.
-- Una mesa fiada cuenta como venta, pero no entra al libro diario hasta que se cobra.

create table public.deudores (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  contacto text,
  notas text,
  created_at timestamptz not null default now()
);

create table public.deudas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  deudor_id uuid not null references public.deudores (id) on delete restrict,
  concepto text not null check (length(trim(concepto)) between 1 and 120),
  monto numeric(12, 2) not null check (monto > 0),
  fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  vence date,
  pago_id uuid references public.pagos (id) on delete set null,
  created_at timestamptz not null default now()
);
create index deudas_deudor on public.deudas (deudor_id);

-- Los cobros son movimientos de ingreso con la deuda asociada (no se borra una deuda con cobros).
alter table public.movimientos add column deuda_id uuid references public.deudas (id) on delete restrict;
create index movimientos_deuda on public.movimientos (deuda_id);

-- "Fiado" como medio al cerrar una mesa.
alter table public.pagos drop constraint pagos_medio_check;
alter table public.pagos add constraint pagos_medio_check check (medio in ('efectivo', 'qr', 'tarjeta', 'fiado'));

alter table public.deudores enable row level security;
alter table public.deudas enable row level security;
create policy deudores_admin on public.deudores for all to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar())
  with check (negocio_id = public.mi_negocio() and public.puede_administrar());
create policy deudas_admin on public.deudas for all to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar())
  with check (negocio_id = public.mi_negocio() and public.puede_administrar()
              and exists (select 1 from public.deudores d where d.id = deudor_id and d.negocio_id = public.mi_negocio()));

create or replace function public.saldo_deuda(p_deuda uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select d.monto - coalesce((select sum(m.monto) from movimientos m where m.deuda_id = d.id), 0) from deudas d where d.id = p_deuda
$$;

-- Clientes a los que se les puede fiar (lo usan también los mozos al cerrar una mesa).
create or replace function public.clientes_para_fiado() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.mi_rol() not in ('mozo', 'duenio')
     or not exists (select 1 from negocios where id = public.mi_negocio() and plan = 'premium') then
    raise exception 'sin_permiso';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre,
            'saldo', (select coalesce(sum(public.saldo_deuda(x.id)), 0) from deudas x where x.deudor_id = d.id)) order by d.nombre)
          from deudores d where d.negocio_id = public.mi_negocio()), '[]');
end $$;

drop function public.cerrar_mesa(uuid, text);
create function public.cerrar_mesa(p_mesa uuid, p_medio text, p_deudor uuid default null, p_nuevo_deudor text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_mesa mesas; v_cuenta uuid; v_total numeric; v_caja uuid; v_pago uuid; v_deudor uuid;
begin
  if public.mi_rol() not in ('mozo', 'duenio') then raise exception 'sin_permiso'; end if;
  select * into v_mesa from mesas where id = p_mesa and negocio_id = public.mi_negocio() for update;
  if not found then raise exception 'mesa_invalida'; end if;

  if p_medio = 'fiado' then
    if not exists (select 1 from negocios where id = v_mesa.negocio_id and plan = 'premium') then raise exception 'fiado_solo_premium'; end if;
    if p_deudor is not null then
      select id into v_deudor from deudores where id = p_deudor and negocio_id = v_mesa.negocio_id;
      if v_deudor is null then raise exception 'cliente_invalido'; end if;
    elsif nullif(trim(p_nuevo_deudor), '') is not null then
      insert into deudores (negocio_id, nombre) values (v_mesa.negocio_id, trim(p_nuevo_deudor)) returning id into v_deudor;
    else
      raise exception 'falta_cliente';
    end if;
  end if;

  select id into v_cuenta from cuentas where mesa_id = p_mesa and cerrada_at is null;
  if v_cuenta is not null then
    select coalesce(sum(total), 0) into v_total from pedidos where cuenta_id = v_cuenta and estado <> 'cancelado';
    select id into v_caja from cajas where negocio_id = v_mesa.negocio_id and cerrada_at is null;
    insert into pagos (negocio_id, cuenta_id, monto, medio, usuario_id, caja_id)
      values (v_mesa.negocio_id, v_cuenta, v_total, p_medio, auth.uid(), v_caja) returning id into v_pago;
    if p_medio = 'fiado' and v_total > 0 then
      insert into deudas (negocio_id, deudor_id, concepto, monto, pago_id)
      values (v_mesa.negocio_id, v_deudor, 'Mesa ' || v_mesa.numero, v_total, v_pago);
    end if;
    update pedidos set estado = 'entregado' where cuenta_id = v_cuenta and estado in ('nuevo', 'preparando', 'listo');
    update cuentas set cerrada_at = now() where id = v_cuenta;
  end if;
  update mesas set estado = 'libre', llamado_at = null where id = p_mesa;
  return coalesce(v_total, 0);
end $$;

-- Cobra a un cliente: salda sus deudas de la más vieja a la más nueva (o una deuda puntual).
create or replace function public.cobrar_deuda(p_deudor uuid, p_monto numeric, p_medio text default 'efectivo', p_deuda uuid default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio(); v_resto numeric := p_monto; v_caja uuid; d record; v_parte numeric; v_nombre text;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  select nombre into v_nombre from deudores where id = p_deudor and negocio_id = v_neg;
  if v_nombre is null then raise exception 'cliente_invalido'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'monto_invalido'; end if;
  if p_monto > (select coalesce(sum(public.saldo_deuda(x.id)), 0) from deudas x
                 where x.deudor_id = p_deudor and (p_deuda is null or x.id = p_deuda)) then
    raise exception 'cobro_mayor_a_la_deuda';
  end if;
  select id into v_caja from cajas where negocio_id = v_neg and cerrada_at is null;
  for d in select x.id, x.concepto, public.saldo_deuda(x.id) as saldo from deudas x
           where x.deudor_id = p_deudor and (p_deuda is null or x.id = p_deuda) and public.saldo_deuda(x.id) > 0
           order by x.fecha, x.created_at loop
    exit when v_resto <= 0;
    v_parte := least(v_resto, d.saldo);
    insert into movimientos (negocio_id, caja_id, tipo, concepto, categoria, monto, medio, usuario_id, deuda_id)
    values (v_neg, v_caja, 'ingreso', left(v_nombre || ': ' || d.concepto, 120), 'Cobro de deudas', v_parte,
            coalesce(p_medio, 'efectivo'), auth.uid(), d.id);
    v_resto := v_resto - v_parte;
  end loop;
  return p_monto - v_resto;
end $$;

-- Clientes con sus deudas, cobros y saldo.
create or replace function public.cuentas_por_cobrar() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(x order by x.saldo = 0, x.saldo desc, x.nombre) from (
    select c.id, c.nombre, c.contacto, c.notas,
           coalesce((select sum(public.saldo_deuda(d.id)) from deudas d where d.deudor_id = c.id), 0) as saldo,
           exists (select 1 from deudas d where d.deudor_id = c.id and d.vence < v_hoy and public.saldo_deuda(d.id) > 0) as vencido,
           (select max(d.fecha) from deudas d where d.deudor_id = c.id) as ultima_deuda,
           (select max(m.fecha) from movimientos m join deudas d on d.id = m.deuda_id where d.deudor_id = c.id) as ultimo_cobro,
           coalesce((select jsonb_agg(jsonb_build_object(
               'id', d.id, 'concepto', d.concepto, 'monto', d.monto, 'fecha', d.fecha, 'vence', d.vence,
               'saldo', public.saldo_deuda(d.id), 'de_mesa', d.pago_id is not null,
               'cobros', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'monto', m.monto, 'medio', m.medio,
                   'borrable', (m.caja_id is null or exists (select 1 from cajas k where k.id = m.caja_id and k.cerrada_at is null)))
                   order by m.fecha) from movimientos m where m.deuda_id = d.id), '[]')
             ) order by d.fecha desc, d.created_at desc) from deudas d where d.deudor_id = c.id), '[]') as deudas
      from deudores c where c.negocio_id = public.mi_negocio()) x), '[]');
end $$;

-- Reporte: "cobrado" no incluye lo fiado (se informa aparte).
create or replace function public.reporte(p_desde timestamptz, p_hasta timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio();
begin
  if public.mi_rol() <> 'duenio' then raise exception 'sin_permiso'; end if;
  return jsonb_build_object(
    'ventas', (select coalesce(sum(monto), 0) from pagos where negocio_id = v_neg and medio <> 'fiado' and created_at between p_desde and p_hasta),
    'fiado', (select coalesce(sum(monto), 0) from pagos where negocio_id = v_neg and medio = 'fiado' and created_at between p_desde and p_hasta),
    'por_medio', (select coalesce(jsonb_object_agg(medio, t), '{}') from
                   (select medio, sum(monto) t from pagos where negocio_id = v_neg and created_at between p_desde and p_hasta group by medio) x),
    'pedidos', (select count(*) from pedidos where negocio_id = v_neg and estado <> 'cancelado' and creado_at between p_desde and p_hasta),
    'espera_promedio_min', (select round(avg(extract(epoch from (listo_at - creado_at)) / 60)::numeric, 1)
                            from pedidos where negocio_id = v_neg and listo_at is not null and creado_at between p_desde and p_hasta),
    'espera_max_min', (select round(max(extract(epoch from (listo_at - creado_at)) / 60)::numeric, 1)
                       from pedidos where negocio_id = v_neg and listo_at is not null and creado_at between p_desde and p_hasta),
    'productos', (select coalesce(jsonb_agg(x order by x.unidades desc), '[]') from (
                   select i.nombre_producto nombre, sum(i.cantidad) unidades, sum(i.cantidad * i.precio_unitario) importe
                   from items_pedido i join pedidos p on p.id = i.pedido_id
                   where p.negocio_id = v_neg and p.estado <> 'cancelado' and p.creado_at between p_desde and p_hasta
                   group by i.nombre_producto) x),
    'opciones', (select coalesce(jsonb_agg(x order by x.grupo, x.veces desc), '[]') from (
                   select o->>'grupo' grupo, o->>'nombre' nombre, sum(i.cantidad) veces
                   from items_pedido i join pedidos p on p.id = i.pedido_id, jsonb_array_elements(i.opciones) o
                   where p.negocio_id = v_neg and p.estado <> 'cancelado' and p.creado_at between p_desde and p_hasta
                   group by 1, 2) x)
  );
end $$;

-- Libro diario: una mesa fiada no es plata que entró; entra cuando se cobra (como movimiento).
create or replace function public.libro_diario(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio();
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  return (
    with asientos as (
      select p.created_at as fecha, 'ingreso'::text as tipo, 'ventas'::text as categoria,
             'Mesa ' || coalesce((select m.numero::text from cuentas cu join mesas m on m.id = cu.mesa_id where cu.id = p.cuenta_id), '?') as concepto,
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

revoke execute on function public.saldo_deuda(uuid) from public, anon;
revoke execute on function public.clientes_para_fiado() from public, anon;
revoke execute on function public.cerrar_mesa(uuid, text, uuid, text) from public, anon;
revoke execute on function public.cobrar_deuda(uuid, numeric, text, uuid) from public, anon;
revoke execute on function public.cuentas_por_cobrar() from public, anon;
grant execute on function public.saldo_deuda(uuid) to authenticated;
grant execute on function public.clientes_para_fiado() to authenticated;
grant execute on function public.cerrar_mesa(uuid, text, uuid, text) to authenticated;
grant execute on function public.cobrar_deuda(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.cuentas_por_cobrar() to authenticated;
