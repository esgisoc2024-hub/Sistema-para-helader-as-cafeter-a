-- Etapa 2 del módulo administrativo: cuentas por pagar (gastos), gastos fijos y proveedores.
-- Cada pago de un gasto es un movimiento de egreso: así entra solo a la caja (si es en efectivo) y al libro diario.

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  contacto text,
  plazo_dias int not null default 0 check (plazo_dias between 0 and 180),
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Lo que le compra a cada proveedor y a qué costo.
create table public.proveedor_items (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  proveedor_id uuid not null references public.proveedores (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  unidad text,
  costo numeric(12, 2) not null default 0 check (costo >= 0),
  updated_at timestamptz not null default now()
);

-- Plantillas de gastos que se repiten todos los meses (alquiler, internet…).
create table public.gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  categoria text not null,
  concepto text not null,
  monto numeric(12, 2) not null check (monto > 0),
  dia_vencimiento int not null default 10 check (dia_vencimiento between 1 and 28),
  proveedor_id uuid references public.proveedores (id) on delete set null,
  activo boolean not null default true,
  desde date not null default (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires'))::date
);

-- Cuentas por pagar: cada gasto o compra con su vencimiento.
create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  categoria text not null check (categoria in
    ('alquiler', 'servicios', 'impuestos', 'sueldos', 'proveedores', 'mantenimiento', 'otros')),
  concepto text not null check (length(trim(concepto)) between 1 and 120),
  monto numeric(12, 2) not null check (monto > 0),
  fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  vence date,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  fijo_id uuid references public.gastos_fijos (id) on delete set null,
  periodo date,
  created_at timestamptz not null default now(),
  unique (fijo_id, periodo)
);
create index gastos_negocio_vence on public.gastos (negocio_id, vence);
alter table public.gastos_fijos add constraint gastos_fijos_categoria_check check (categoria in
  ('alquiler', 'servicios', 'impuestos', 'sueldos', 'proveedores', 'mantenimiento', 'otros'));

-- Vencimiento por defecto: el plazo del proveedor, o el mismo día.
create or replace function public.tg_gasto_vence() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.vence is null then
    new.vence := new.fecha + coalesce((select plazo_dias from proveedores where id = new.proveedor_id), 0);
  end if;
  return new;
end $$;
create trigger gasto_vence before insert on public.gastos for each row execute function public.tg_gasto_vence();

-- Los pagos de gastos son movimientos de egreso con el gasto asociado.
-- "restrict": un gasto con pagos no se puede borrar (hay que borrar los pagos primero).
alter table public.movimientos add column gasto_id uuid references public.gastos (id) on delete restrict;
create index movimientos_gasto on public.movimientos (gasto_id);

alter table public.proveedores enable row level security;
alter table public.proveedor_items enable row level security;
alter table public.gastos_fijos enable row level security;
alter table public.gastos enable row level security;
create policy proveedores_admin on public.proveedores for all to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar())
  with check (negocio_id = public.mi_negocio() and public.puede_administrar());
create policy proveedor_items_admin on public.proveedor_items for all to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar())
  with check (negocio_id = public.mi_negocio() and public.puede_administrar()
              and exists (select 1 from public.proveedores p where p.id = proveedor_id and p.negocio_id = public.mi_negocio()));
create policy gastos_fijos_admin on public.gastos_fijos for all to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar())
  with check (negocio_id = public.mi_negocio() and public.puede_administrar());
create policy gastos_admin on public.gastos for all to authenticated
  using (negocio_id = public.mi_negocio() and public.puede_administrar())
  with check (negocio_id = public.mi_negocio() and public.puede_administrar()
              and (proveedor_id is null or exists (select 1 from public.proveedores p where p.id = proveedor_id and p.negocio_id = public.mi_negocio())));

create or replace function public.etiqueta_categoria(p text) returns text
language sql immutable set search_path = public as $$
  select case p when 'alquiler' then 'Alquiler' when 'servicios' then 'Servicios' when 'impuestos' then 'Impuestos'
    when 'sueldos' then 'Sueldos' when 'proveedores' then 'Proveedores' when 'mantenimiento' then 'Mantenimiento'
    else 'Otros' end
$$;

-- Crea los gastos fijos del mes en curso (y de meses pasados desde su alta) que todavía no existan.
create or replace function public.generar_gastos_fijos() returns int
language plpgsql security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio(); v_n int;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  insert into gastos (negocio_id, categoria, concepto, monto, fecha, vence, proveedor_id, fijo_id, periodo)
  select f.negocio_id, f.categoria, f.concepto, f.monto, m.mes, m.mes + (f.dia_vencimiento - 1), f.proveedor_id, f.id, m.mes
    from gastos_fijos f
    cross join lateral (
      select generate_series(f.desde, date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date, interval '1 month')::date as mes
    ) m
   where f.negocio_id = v_neg and f.activo
  on conflict (fijo_id, periodo) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.pagar_gasto(p_gasto uuid, p_monto numeric, p_medio text default 'efectivo')
returns uuid language plpgsql security definer set search_path = public as $$
declare g gastos; v_saldo numeric; v_id uuid; v_caja uuid;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  select * into g from gastos where id = p_gasto and negocio_id = public.mi_negocio() for update;
  if not found then raise exception 'gasto_invalido'; end if;
  v_saldo := g.monto - coalesce((select sum(monto) from movimientos where gasto_id = g.id), 0);
  if p_monto is null or p_monto <= 0 then raise exception 'monto_invalido'; end if;
  if p_monto > v_saldo then raise exception 'pago_mayor_al_saldo'; end if;
  select id into v_caja from cajas where negocio_id = g.negocio_id and cerrada_at is null;
  insert into movimientos (negocio_id, caja_id, tipo, concepto, categoria, monto, medio, usuario_id, gasto_id)
  values (g.negocio_id, v_caja, 'egreso',
          left(coalesce((select nombre || ': ' from proveedores where id = g.proveedor_id), '') || g.concepto, 120),
          public.etiqueta_categoria(g.categoria), p_monto, coalesce(p_medio, 'efectivo'), auth.uid(), g.id)
  returning id into v_id;
  return v_id;
end $$;

-- Lista de cuentas por pagar con lo pagado, el saldo y el estado.
create or replace function public.cuentas_por_pagar() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(x order by x.saldo = 0, x.vence, x.fecha) from (
    select g.id, g.categoria, g.concepto, g.monto, g.fecha, g.vence, g.proveedor_id, g.fijo_id,
           p.nombre as proveedor,
           coalesce(pg.pagado, 0) as pagado, g.monto - coalesce(pg.pagado, 0) as saldo,
           case when g.monto - coalesce(pg.pagado, 0) <= 0 then 'pagado'
                when g.vence < v_hoy then 'vencido'
                when g.vence <= v_hoy + 7 then 'por_vencer'
                else 'pendiente' end as estado,
           coalesce(pg.pagos, '[]'::jsonb) as pagos
      from gastos g
      left join proveedores p on p.id = g.proveedor_id
      left join lateral (
        select sum(m.monto) as pagado,
               jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'monto', m.monto, 'medio', m.medio,
                 'borrable', (m.caja_id is null or exists (select 1 from cajas c where c.id = m.caja_id and c.cerrada_at is null)))
                 order by m.fecha) as pagos
          from movimientos m where m.gasto_id = g.id
      ) pg on true
     where g.negocio_id = public.mi_negocio()) x), '[]');
end $$;

-- Proveedores con sus artículos, lo que se les debe y las últimas fechas.
create or replace function public.resumen_proveedores() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puede_administrar() then raise exception 'sin_permiso'; end if;
  return coalesce((select jsonb_agg(x order by x.activo desc, x.nombre) from (
    select p.id, p.nombre, p.contacto, p.plazo_dias, p.notas, p.activo,
           coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre, 'unidad', i.unidad, 'costo', i.costo, 'updated_at', i.updated_at) order by i.nombre)
                       from proveedor_items i where i.proveedor_id = p.id), '[]') as items,
           (select coalesce(sum(g.monto), 0) from gastos g where g.proveedor_id = p.id)
             - (select coalesce(sum(m.monto), 0) from movimientos m join gastos g on g.id = m.gasto_id where g.proveedor_id = p.id) as deuda,
           (select max(g.fecha) from gastos g where g.proveedor_id = p.id) as ultima_compra,
           (select max(m.fecha) from movimientos m join gastos g on g.id = m.gasto_id where g.proveedor_id = p.id) as ultimo_pago,
           (select min(g.vence) from gastos g where g.proveedor_id = p.id
              and g.monto > coalesce((select sum(m.monto) from movimientos m where m.gasto_id = g.id), 0)) as proximo_vencimiento
      from proveedores p where p.negocio_id = public.mi_negocio()) x), '[]');
end $$;

-- borrar_movimiento ya protege los de cajas cerradas; sirve también para anular un pago de un gasto.

revoke execute on function public.generar_gastos_fijos() from public, anon;
revoke execute on function public.pagar_gasto(uuid, numeric, text) from public, anon;
revoke execute on function public.cuentas_por_pagar() from public, anon;
revoke execute on function public.resumen_proveedores() from public, anon;
grant execute on function public.generar_gastos_fijos() to authenticated;
grant execute on function public.pagar_gasto(uuid, numeric, text) to authenticated;
grant execute on function public.cuentas_por_pagar() to authenticated;
grant execute on function public.resumen_proveedores() to authenticated;
