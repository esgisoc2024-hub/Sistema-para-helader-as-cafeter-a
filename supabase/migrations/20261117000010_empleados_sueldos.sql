-- Etapa 4 del módulo administrativo: empleados y sueldos con comisión configurable por empleado.
-- Cada liquidación crea una cuenta por pagar (categoría "sueldos"): se paga desde ahí, sale de la caja
-- si es en efectivo y aparece en el libro diario.

create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  puesto text,
  contacto text,
  usuario_id uuid references public.usuarios (id) on delete set null, -- su cuenta del equipo (para "% de lo que cobró")
  sueldo_base numeric(12, 2) not null default 0 check (sueldo_base >= 0),
  comision_tipo text not null default 'ninguna' check (comision_tipo in ('ninguna', 'cobrado', 'ventas_total', 'fijo')),
  comision_valor numeric(12, 2) not null default 0 check (comision_valor >= 0),
  fecha_ingreso date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  check (comision_tipo not in ('cobrado', 'ventas_total') or comision_valor <= 100)
);

create table public.liquidaciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  empleado_id uuid not null references public.empleados (id) on delete restrict,
  periodo date not null,                 -- primer día del mes liquidado
  sueldo_base numeric(12, 2) not null,
  comision_tipo text not null,
  comision_valor numeric(12, 2) not null,
  base_comision numeric(12, 2) not null, -- sobre qué se calculó (lo cobrado o las ventas del mes)
  comision numeric(12, 2) not null,
  adicionales numeric(12, 2) not null default 0 check (adicionales >= 0),
  descuentos numeric(12, 2) not null default 0 check (descuentos >= 0),
  total numeric(12, 2) not null check (total >= 0),
  nota text,
  gasto_id uuid references public.gastos (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (empleado_id, periodo)
);

alter table public.empleados enable row level security;
alter table public.liquidaciones enable row level security;
create policy empleados_admin on public.empleados for all to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar())
  with check (negocio_id = public.mi_negocio() and public.puede_administrar()
              and (usuario_id is null or exists (select 1 from public.usuarios u where u.id = usuario_id and u.negocio_id = public.mi_negocio())));
create policy liquidaciones_ver on public.liquidaciones for select to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar());

-- Cálculo del sueldo de un empleado en un mes (sin guardar nada).
create or replace function public.calcular_sueldo(p_empleado uuid, p_periodo date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare e empleados; v_desde timestamptz; v_hasta timestamptz; v_base numeric := 0; v_comision numeric := 0;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  select * into e from empleados where id = p_empleado and negocio_id = public.mi_negocio();
  if not found then raise exception 'empleado_invalido'; end if;
  v_desde := (date_trunc('month', p_periodo)::date)::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_hasta := ((date_trunc('month', p_periodo) + interval '1 month')::date)::timestamp at time zone 'America/Argentina/Buenos_Aires';

  if e.comision_tipo = 'cobrado' and e.usuario_id is not null then
    select coalesce(sum(monto), 0) into v_base from pagos
     where negocio_id = e.negocio_id and usuario_id = e.usuario_id and created_at >= v_desde and created_at < v_hasta;
  elsif e.comision_tipo = 'ventas_total' then
    select coalesce(sum(monto), 0) into v_base from pagos
     where negocio_id = e.negocio_id and created_at >= v_desde and created_at < v_hasta;
  end if;

  v_comision := case e.comision_tipo
    when 'cobrado' then round(v_base * e.comision_valor / 100, 2)
    when 'ventas_total' then round(v_base * e.comision_valor / 100, 2)
    when 'fijo' then e.comision_valor
    else 0 end;

  return jsonb_build_object('sueldo_base', e.sueldo_base, 'comision_tipo', e.comision_tipo, 'comision_valor', e.comision_valor,
    'base_comision', v_base, 'comision', v_comision, 'total', e.sueldo_base + v_comision,
    'sin_cuenta', e.comision_tipo = 'cobrado' and e.usuario_id is null);
end $$;

-- Liquida el mes: guarda el cálculo y crea la cuenta por pagar (vence el 5 del mes siguiente).
create or replace function public.liquidar_sueldo(p_empleado uuid, p_periodo date, p_adicionales numeric default 0,
  p_descuentos numeric default 0, p_nota text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare e empleados; c jsonb; v_periodo date := date_trunc('month', p_periodo)::date; v_total numeric; v_gasto uuid; v_id uuid;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  select * into e from empleados where id = p_empleado and negocio_id = public.mi_negocio();
  if not found then raise exception 'empleado_invalido'; end if;
  if exists (select 1 from liquidaciones where empleado_id = p_empleado and periodo = v_periodo) then raise exception 'ya_liquidado'; end if;
  c := public.calcular_sueldo(p_empleado, v_periodo);
  v_total := (c->>'total')::numeric + coalesce(p_adicionales, 0) - coalesce(p_descuentos, 0);
  if v_total < 0 then raise exception 'total_negativo'; end if;

  if v_total > 0 then
    insert into gastos (negocio_id, categoria, concepto, monto, fecha, vence)
    values (e.negocio_id, 'sueldos',
            left('Sueldo ' || e.nombre || ' · ' || to_char(v_periodo, 'MM/YYYY'), 120), v_total,
            (v_periodo + interval '1 month' - interval '1 day')::date, (v_periodo + interval '1 month' + interval '4 days')::date)
    returning id into v_gasto;
  end if;

  insert into liquidaciones (negocio_id, empleado_id, periodo, sueldo_base, comision_tipo, comision_valor, base_comision,
                             comision, adicionales, descuentos, total, nota, gasto_id)
  values (e.negocio_id, e.id, v_periodo, (c->>'sueldo_base')::numeric, c->>'comision_tipo', (c->>'comision_valor')::numeric,
          (c->>'base_comision')::numeric, (c->>'comision')::numeric, coalesce(p_adicionales, 0), coalesce(p_descuentos, 0),
          v_total, nullif(trim(p_nota), ''), v_gasto)
  returning id into v_id;
  return v_id;
end $$;

-- Deshace una liquidación (solo si su sueldo todavía no tiene pagos).
create or replace function public.anular_liquidacion(p_liquidacion uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l liquidaciones;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  select * into l from liquidaciones where id = p_liquidacion and negocio_id = public.mi_negocio();
  if not found then raise exception 'liquidacion_invalida'; end if;
  if l.gasto_id is not null and exists (select 1 from movimientos where gasto_id = l.gasto_id) then raise exception 'sueldo_con_pagos'; end if;
  delete from liquidaciones where id = l.id;
  if l.gasto_id is not null then delete from gastos where id = l.gasto_id; end if;
end $$;

-- Empleados con el sueldo calculado del mes y, si ya se liquidó, lo pagado.
create or replace function public.sueldos_del_mes(p_periodo date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_periodo date := date_trunc('month', p_periodo)::date;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(x order by x.activo desc, x.nombre) from (
    select e.id, e.nombre, e.puesto, e.contacto, e.usuario_id, e.sueldo_base, e.comision_tipo, e.comision_valor,
           e.fecha_ingreso, e.activo,
           (select u.nombre from usuarios u where u.id = e.usuario_id) as cuenta,
           public.calcular_sueldo(e.id, v_periodo) as calculo,
           (select jsonb_build_object('id', l.id, 'total', l.total, 'comision', l.comision, 'base_comision', l.base_comision,
                     'sueldo_base', l.sueldo_base, 'adicionales', l.adicionales, 'descuentos', l.descuentos, 'nota', l.nota,
                     'gasto_id', l.gasto_id, 'vence', g.vence,
                     'pagado', coalesce((select sum(m.monto) from movimientos m where m.gasto_id = l.gasto_id), 0))
              from liquidaciones l left join gastos g on g.id = l.gasto_id
             where l.empleado_id = e.id and l.periodo = v_periodo) as liquidacion
      from empleados e where e.negocio_id = public.mi_negocio()) x), '[]');
end $$;

revoke execute on function public.calcular_sueldo(uuid, date) from public, anon;
revoke execute on function public.liquidar_sueldo(uuid, date, numeric, numeric, text) from public, anon;
revoke execute on function public.anular_liquidacion(uuid) from public, anon;
revoke execute on function public.sueldos_del_mes(date) from public, anon;
grant execute on function public.calcular_sueldo(uuid, date) to authenticated;
grant execute on function public.liquidar_sueldo(uuid, date, numeric, numeric, text) to authenticated;
grant execute on function public.anular_liquidacion(uuid) to authenticated;
grant execute on function public.sueldos_del_mes(date) to authenticated;
