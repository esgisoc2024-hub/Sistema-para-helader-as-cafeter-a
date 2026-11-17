-- Etapa 1 del módulo administrativo (plan Premium): plan por local, caja y libro diario.

-- ── Plan del local ──
alter table public.negocios alter column plan drop default;
update public.negocios set plan = 'basico' where plan not in ('basico', 'premium');
alter table public.negocios alter column plan set default 'basico';
alter table public.negocios add constraint negocios_plan_check check (plan in ('basico', 'premium'));

-- Administración: solo el dueño de un local Premium.
create or replace function public.puede_administrar() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios u join negocios n on n.id = u.negocio_id
                 where u.id = auth.uid() and u.rol = 'duenio' and n.plan = 'premium')
$$;

-- ── Caja ──
create table public.cajas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  abierta_at timestamptz not null default now(),
  abierta_por uuid references public.usuarios (id) on delete set null,
  monto_inicial numeric(12, 2) not null check (monto_inicial >= 0),
  cerrada_at timestamptz,
  cerrada_por uuid references public.usuarios (id) on delete set null,
  efectivo_contado numeric(12, 2) check (efectivo_contado >= 0),
  efectivo_esperado numeric(12, 2),
  notas text
);
create unique index cajas_una_abierta on public.cajas (negocio_id) where cerrada_at is null;
create index cajas_negocio_fecha on public.cajas (negocio_id, abierta_at desc);

-- Ingresos y egresos cargados a mano (retiros, cambio, gastos chicos, otros ingresos).
create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  caja_id uuid references public.cajas (id) on delete set null,
  fecha timestamptz not null default now(),
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  concepto text not null check (length(trim(concepto)) between 1 and 120),
  categoria text not null default 'otros',
  monto numeric(12, 2) not null check (monto > 0),
  medio text not null default 'efectivo' check (medio in ('efectivo', 'qr', 'tarjeta', 'transferencia')),
  usuario_id uuid references public.usuarios (id) on delete set null
);
create index movimientos_negocio_fecha on public.movimientos (negocio_id, fecha desc);

-- Las ventas cobradas desde Mesas quedan asociadas a la caja abierta en ese momento.
alter table public.pagos add column caja_id uuid references public.cajas (id) on delete set null;
create index pagos_negocio_fecha on public.pagos (negocio_id, created_at desc);

alter table public.cajas enable row level security;
alter table public.movimientos enable row level security;
create policy cajas_ver on public.cajas for select to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar());
create policy movimientos_ver on public.movimientos for select to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar());
-- Las escrituras van solo por las funciones de abajo.

create or replace function public.cerrar_mesa(p_mesa uuid, p_medio text)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_mesa mesas; v_cuenta uuid; v_total numeric; v_caja uuid;
begin
  if public.mi_rol() not in ('mozo', 'duenio') then raise exception 'sin_permiso'; end if;
  select * into v_mesa from mesas where id = p_mesa and negocio_id = public.mi_negocio() for update;
  if not found then raise exception 'mesa_invalida'; end if;
  select id into v_cuenta from cuentas where mesa_id = p_mesa and cerrada_at is null;
  if v_cuenta is not null then
    select coalesce(sum(total), 0) into v_total from pedidos where cuenta_id = v_cuenta and estado <> 'cancelado';
    select id into v_caja from cajas where negocio_id = v_mesa.negocio_id and cerrada_at is null;
    insert into pagos (negocio_id, cuenta_id, monto, medio, usuario_id, caja_id)
      values (v_mesa.negocio_id, v_cuenta, v_total, p_medio, auth.uid(), v_caja);
    update pedidos set estado = 'entregado' where cuenta_id = v_cuenta and estado in ('nuevo', 'preparando', 'listo');
    update cuentas set cerrada_at = now() where id = v_cuenta;
  end if;
  update mesas set estado = 'libre', llamado_at = null where id = p_mesa;
  return coalesce(v_total, 0);
end $$;

create or replace function public.abrir_caja(p_monto_inicial numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  if exists (select 1 from cajas where negocio_id = public.mi_negocio() and cerrada_at is null) then
    raise exception 'caja_ya_abierta';
  end if;
  insert into cajas (negocio_id, abierta_por, monto_inicial)
  values (public.mi_negocio(), auth.uid(), coalesce(p_monto_inicial, 0)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.registrar_movimiento(
  p_tipo text, p_concepto text, p_monto numeric, p_medio text default 'efectivo', p_categoria text default 'otros')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_caja uuid;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  select id into v_caja from cajas where negocio_id = public.mi_negocio() and cerrada_at is null;
  insert into movimientos (negocio_id, caja_id, tipo, concepto, categoria, monto, medio, usuario_id)
  values (public.mi_negocio(), v_caja, p_tipo, trim(p_concepto), coalesce(nullif(trim(p_categoria), ''), 'otros'),
          p_monto, coalesce(p_medio, 'efectivo'), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.borrar_movimiento(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  -- No se tocan movimientos de una caja ya cerrada: el cierre quedaría descuadrado.
  delete from movimientos m where m.id = p_id and m.negocio_id = public.mi_negocio()
    and (m.caja_id is null or exists (select 1 from cajas c where c.id = m.caja_id and c.cerrada_at is null));
  if not found then raise exception 'no_se_puede_borrar'; end if;
end $$;

-- Resumen de una caja (la abierta si no se indica): totales por medio y efectivo esperado.
create or replace function public.resumen_caja(p_caja uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c cajas; v_ventas jsonb; v_ing numeric; v_egr numeric; v_ing_ef numeric; v_egr_ef numeric; v_ven_ef numeric;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  if p_caja is null then
    select * into c from cajas where negocio_id = public.mi_negocio() and cerrada_at is null;
  else
    select * into c from cajas where id = p_caja and negocio_id = public.mi_negocio();
  end if;
  if not found then return null; end if;

  select coalesce(jsonb_object_agg(medio, total), '{}') into v_ventas
    from (select medio, sum(monto) total from pagos where caja_id = c.id group by medio) x;
  select coalesce(sum(monto) filter (where tipo = 'ingreso'), 0), coalesce(sum(monto) filter (where tipo = 'egreso'), 0),
         coalesce(sum(monto) filter (where tipo = 'ingreso' and medio = 'efectivo'), 0),
         coalesce(sum(monto) filter (where tipo = 'egreso' and medio = 'efectivo'), 0)
    into v_ing, v_egr, v_ing_ef, v_egr_ef
    from movimientos where caja_id = c.id;
  select coalesce(sum(monto), 0) into v_ven_ef from pagos where caja_id = c.id and medio = 'efectivo';

  return jsonb_build_object(
    'id', c.id, 'abierta_at', c.abierta_at, 'cerrada_at', c.cerrada_at,
    'abierta_por', (select nombre from usuarios where id = c.abierta_por),
    'cerrada_por', (select nombre from usuarios where id = c.cerrada_por),
    'monto_inicial', c.monto_inicial,
    'ventas', v_ventas,
    'ventas_total', (select coalesce(sum(monto), 0) from pagos where caja_id = c.id),
    'mesas_cobradas', (select count(*) from pagos where caja_id = c.id),
    'ingresos', v_ing, 'egresos', v_egr,
    'efectivo_esperado', coalesce(c.efectivo_esperado, c.monto_inicial + v_ven_ef + v_ing_ef - v_egr_ef),
    'efectivo_contado', c.efectivo_contado,
    'notas', c.notas,
    'movimientos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'concepto', m.concepto, 'categoria', m.categoria,
        'monto', m.monto, 'medio', m.medio) order by m.fecha desc) from movimientos m where m.caja_id = c.id), '[]')
  );
end $$;

create or replace function public.cerrar_caja(p_efectivo_contado numeric, p_notas text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_esperado numeric;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  select id into v_id from cajas where negocio_id = public.mi_negocio() and cerrada_at is null for update;
  if v_id is null then raise exception 'sin_caja_abierta'; end if;
  v_esperado := (public.resumen_caja(v_id) ->> 'efectivo_esperado')::numeric;
  update cajas set cerrada_at = now(), cerrada_por = auth.uid(), efectivo_contado = p_efectivo_contado,
                   efectivo_esperado = v_esperado, notas = nullif(trim(p_notas), '')
   where id = v_id;
  return public.resumen_caja(v_id);
end $$;

create or replace function public.historial_cajas(p_limite int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(x order by x.abierta_at desc) from (
    select c.id, c.abierta_at, c.cerrada_at, c.monto_inicial, c.efectivo_esperado, c.efectivo_contado,
           c.efectivo_contado - c.efectivo_esperado as diferencia,
           (select coalesce(sum(monto), 0) from pagos where caja_id = c.id) as ventas
      from cajas c where c.negocio_id = public.mi_negocio() and c.cerrada_at is not null
      order by c.abierta_at desc limit p_limite) x), '[]');
end $$;

-- ── Libro diario ──
-- Une todo lo que entra y sale. Las próximas etapas (gastos, proveedores, cobros, sueldos) suman sus fuentes acá.
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
        from pagos p where p.negocio_id = v_neg and p.monto > 0
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

-- ── Administradora de la plataforma: también cambia el plan ──
drop function public.admin_actualizar_local(uuid, text, text, date, text);
create function public.admin_actualizar_local(
  p_negocio uuid, p_estado text, p_contacto text, p_pagado_hasta date, p_notas text, p_plan text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  update negocios set estado = p_estado, plan = coalesce(p_plan, plan) where id = p_negocio;
  if not found then raise exception 'local_invalido'; end if;
  insert into admin_seguimiento (negocio_id, contacto, pagado_hasta, notas)
  values (p_negocio, nullif(trim(p_contacto), ''), p_pagado_hasta, nullif(trim(p_notas), ''))
  on conflict (negocio_id) do update
    set contacto = excluded.contacto, pagado_hasta = excluded.pagado_hasta, notas = excluded.notas, updated_at = now();
end $$;

create or replace function public.admin_locales() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'nombre', n.nombre, 'estado', n.estado, 'plan', n.plan, 'alta', n.created_at, 'logo_url', n.logo_url,
      'duenio', d.nombre, 'email', d.email,
      'equipo', (select count(*) from usuarios u where u.negocio_id = n.id),
      'mesas', (select count(*) from mesas m where m.negocio_id = n.id and m.activa),
      'productos', (select count(*) from productos p where p.negocio_id = n.id),
      'pedidos_7d', (select count(*) from pedidos p where p.negocio_id = n.id and p.estado <> 'cancelado' and p.creado_at > now() - interval '7 days'),
      'pedidos_30d', (select count(*) from pedidos p where p.negocio_id = n.id and p.estado <> 'cancelado' and p.creado_at > now() - interval '30 days'),
      'ventas_30d', (select coalesce(sum(monto), 0) from pagos g where g.negocio_id = n.id and g.created_at > now() - interval '30 days'),
      'ultimo_pedido', (select max(creado_at) from pedidos p where p.negocio_id = n.id),
      'contacto', s.contacto, 'pagado_hasta', s.pagado_hasta, 'notas', s.notas
    ) order by n.created_at desc)
    from negocios n
    left join admin_seguimiento s on s.negocio_id = n.id
    left join lateral (
      select u.nombre, au.email from usuarios u join auth.users au on au.id = u.id
      where u.negocio_id = n.id and u.rol = 'duenio' order by u.created_at limit 1
    ) d on true
  ), '[]'::jsonb);
end $$;

revoke execute on function public.puede_administrar() from public, anon;
revoke execute on function public.abrir_caja(numeric) from public, anon;
revoke execute on function public.registrar_movimiento(text, text, numeric, text, text) from public, anon;
revoke execute on function public.borrar_movimiento(uuid) from public, anon;
revoke execute on function public.resumen_caja(uuid) from public, anon;
revoke execute on function public.cerrar_caja(numeric, text) from public, anon;
revoke execute on function public.historial_cajas(int) from public, anon;
revoke execute on function public.libro_diario(date, date) from public, anon;
revoke execute on function public.admin_actualizar_local(uuid, text, text, date, text, text) from public, anon;
grant execute on function public.puede_administrar() to authenticated;
grant execute on function public.abrir_caja(numeric) to authenticated;
grant execute on function public.registrar_movimiento(text, text, numeric, text, text) to authenticated;
grant execute on function public.borrar_movimiento(uuid) to authenticated;
grant execute on function public.resumen_caja(uuid) to authenticated;
grant execute on function public.cerrar_caja(numeric, text) to authenticated;
grant execute on function public.historial_cajas(int) to authenticated;
grant execute on function public.libro_diario(date, date) to authenticated;
grant execute on function public.admin_actualizar_local(uuid, text, text, date, text, text) to authenticated;
