-- Etapa 5 del módulo administrativo: costos y márgenes por producto, historial de precios y resultado del mes.

-- Costo de cada producto, aparte de "productos": el personal ve la carta pero no los costos.
create table public.producto_costos (
  producto_id uuid primary key references public.productos (id) on delete cascade,
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  costo numeric(12, 2) not null check (costo >= 0),
  updated_at timestamptz not null default now()
);
alter table public.producto_costos enable row level security;
create policy producto_costos_admin on public.producto_costos for all to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar())
  with check (negocio_id = public.mi_negocio() and public.puede_administrar()
              and exists (select 1 from public.productos p where p.id = producto_id and p.negocio_id = public.mi_negocio()));

-- Historial de cambios de precio (lo carga solo un trigger).
create table public.precios_historial (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  precio_anterior numeric(12, 2) not null,
  precio_nuevo numeric(12, 2) not null,
  cambiado_at timestamptz not null default now()
);
create index precios_historial_producto on public.precios_historial (producto_id, cambiado_at desc);
alter table public.precios_historial enable row level security;
create policy precios_historial_ver on public.precios_historial for select to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar());

create or replace function public.tg_precio_historial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.precio is distinct from old.precio then
    insert into precios_historial (negocio_id, producto_id, precio_anterior, precio_nuevo)
    values (new.negocio_id, new.id, old.precio, new.precio);
  end if;
  return new;
end $$;
create trigger producto_precio_historial after update of precio on public.productos
  for each row execute function public.tg_precio_historial();

-- Margen mínimo deseado del local (para avisar qué productos dejan poco).
alter table public.negocios add column margen_minimo int not null default 50 check (margen_minimo between 0 and 95);
grant update (margen_minimo) on public.negocios to authenticated;

-- Productos con precio, costo, margen, ventas y última suba de precio.
create or replace function public.margenes(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio(); v_desde timestamptz := now() - make_interval(days => greatest(p_dias, 1));
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  return jsonb_build_object(
    'margen_minimo', (select margen_minimo from negocios where id = v_neg),
    'productos', coalesce((select jsonb_agg(x order by x.categoria_orden, x.categoria, x.orden, x.nombre) from (
      select p.id, p.nombre, p.precio, p.disponible, p.orden, c.nombre as categoria, c.orden as categoria_orden,
             k.costo, k.updated_at as costo_actualizado,
             case when k.costo is not null then p.precio - k.costo end as margen,
             case when k.costo is not null and p.precio > 0 then round((p.precio - k.costo) / p.precio * 100, 1) end as margen_pct,
             coalesce(v.unidades, 0) as unidades, coalesce(v.vendido, 0) as vendido,
             case when k.costo is not null then coalesce(v.vendido, 0) - coalesce(v.unidades, 0) * k.costo end as ganancia,
             (select max(h.cambiado_at) from precios_historial h where h.producto_id = p.id) as ultimo_cambio_precio,
             (select h.precio_anterior from precios_historial h where h.producto_id = p.id order by h.cambiado_at desc limit 1) as precio_anterior
        from productos p
        join categorias c on c.id = p.categoria_id
        left join producto_costos k on k.producto_id = p.id
        left join lateral (
          select sum(i.cantidad) as unidades, sum(i.cantidad * i.precio_unitario) as vendido
            from items_pedido i join pedidos pe on pe.id = i.pedido_id
           where i.producto_id = p.id and pe.estado <> 'cancelado' and pe.creado_at >= v_desde
        ) v on true
       where p.negocio_id = v_neg) x), '[]')
  );
end $$;

-- Cálculo del resultado de un período (uso interno).
create or replace function public.resultado_periodo(p_neg uuid, p_desde date, p_hasta date)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  rango as (
    select (p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires') as t0,
           ((p_hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires') as t1
  ),
  ventas as (
    select coalesce(sum(monto), 0) as total, coalesce(sum(monto) filter (where medio = 'fiado'), 0) as fiado
      from pagos, rango where negocio_id = p_neg and created_at >= t0 and created_at < t1
  ),
  manuales as (  -- entradas y salidas cargadas a mano en la caja (no cobros de deudas ni pagos de cuentas)
    select m.tipo, m.categoria, sum(m.monto) as monto
      from movimientos m, rango
     where m.negocio_id = p_neg and m.fecha >= t0 and m.fecha < t1 and m.gasto_id is null and m.deuda_id is null
     group by 1, 2
  ),
  gastos_mes as (
    select g.categoria, sum(g.monto) as monto from gastos g
     where g.negocio_id = p_neg and g.fecha between p_desde and p_hasta group by 1
  ),
  rubros as (
    select public.etiqueta_categoria(categoria) as rubro, monto from gastos_mes
    union all
    select categoria, monto from manuales where tipo = 'egreso' and categoria <> 'Retiro del dueño'
  ),
  rubros_agrupados as (select rubro, sum(monto) as monto from rubros group by 1)
  select jsonb_build_object(
    'ventas', (select total from ventas),
    'fiado', (select fiado from ventas),
    'otros_ingresos', coalesce((select sum(monto) from manuales where tipo = 'ingreso' and categoria <> 'Aporte de cambio'), 0),
    'gastos', coalesce((select jsonb_agg(jsonb_build_object('rubro', rubro, 'monto', monto) order by monto desc) from rubros_agrupados), '[]'),
    'total_gastos', coalesce((select sum(monto) from rubros_agrupados), 0),
    'retiros', coalesce((select sum(monto) from manuales where tipo = 'egreso' and categoria = 'Retiro del dueño'), 0)
  )
$$;
revoke execute on function public.resultado_periodo(uuid, date, date) from public, anon, authenticated;

create or replace function public.resultado_mes(p_periodo date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_neg uuid := public.mi_negocio();
  v_ini date := date_trunc('month', p_periodo)::date;
  v_fin date := (date_trunc('month', p_periodo) + interval '1 month' - interval '1 day')::date;
  v_ant_ini date := (date_trunc('month', p_periodo) - interval '1 month')::date;
  v_act jsonb; v_ant jsonb; v_sin_liquidar numeric;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  v_act := public.resultado_periodo(v_neg, v_ini, v_fin);
  v_ant := public.resultado_periodo(v_neg, v_ant_ini, (v_ini - 1));
  select coalesce(sum((public.calcular_sueldo(e.id, v_ini)->>'total')::numeric), 0) into v_sin_liquidar
    from empleados e
   where e.negocio_id = v_neg and e.activo
     and not exists (select 1 from liquidaciones l where l.empleado_id = e.id and l.periodo = v_ini);
  return v_act || jsonb_build_object(
    'resultado', (v_act->>'ventas')::numeric + (v_act->>'otros_ingresos')::numeric - (v_act->>'total_gastos')::numeric,
    'sueldos_sin_liquidar', v_sin_liquidar,
    'te_deben', (select coalesce(sum(public.saldo_deuda(d.id)), 0) from deudas d where d.negocio_id = v_neg),
    'debes', (select coalesce(sum(g.monto), 0) from gastos g where g.negocio_id = v_neg)
             - (select coalesce(sum(m.monto), 0) from movimientos m where m.negocio_id = v_neg and m.gasto_id is not null),
    'anterior', v_ant || jsonb_build_object('resultado',
      (v_ant->>'ventas')::numeric + (v_ant->>'otros_ingresos')::numeric - (v_ant->>'total_gastos')::numeric)
  );
end $$;

revoke execute on function public.margenes(int) from public, anon;
revoke execute on function public.resultado_mes(date) from public, anon;
grant execute on function public.margenes(int) to authenticated;
grant execute on function public.resultado_mes(date) to authenticated;
