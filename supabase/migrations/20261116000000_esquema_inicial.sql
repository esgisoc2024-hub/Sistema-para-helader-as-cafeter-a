-- Sistema para heladerías-cafetería: esquema inicial (versión 1)
-- Cada local es un "negocio"; todas las tablas llevan negocio_id y RLS por negocio.
-- El cliente (sin cuenta) solo accede a través de las funciones *_mesa / crear_pedido.

create extension if not exists pgcrypto;

-- ───────────────────────── Tablas ─────────────────────────

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  direccion text,
  plan text not null default 'prueba',
  codigo_equipo text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('duenio', 'mozo', 'barra')),
  created_at timestamptz not null default now()
);

create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  numero int not null check (numero > 0),
  codigo text not null unique default lower(substr(md5(gen_random_uuid()::text), 1, 10)),
  estado text not null default 'libre' check (estado in ('libre', 'ocupada', 'pide_cuenta')),
  llamado_at timestamptz,
  activa boolean not null default true,
  unique (negocio_id, numero)
);

-- Una "cuenta" es la visita de un grupo a una mesa: se abre con el primer pedido y se cierra al cobrar.
create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  abierta_at timestamptz not null default now(),
  cerrada_at timestamptz
);
create unique index cuentas_una_abierta_por_mesa on public.cuentas (mesa_id) where cerrada_at is null;

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null,
  orden int not null default 0
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric(12, 2) not null check (precio >= 0),
  foto_url text,
  disponible boolean not null default true,
  max_sabores int not null default 0 check (max_sabores between 0 and 6),
  orden int not null default 0
);

create table public.sabores (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null,
  disponible boolean not null default true
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  cuenta_id uuid not null references public.cuentas (id) on delete cascade,
  numero_mesa int not null,
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'preparando', 'listo', 'entregado', 'cancelado')),
  origen text not null default 'qr' check (origen in ('qr', 'mozo')),
  total numeric(12, 2) not null default 0,
  creado_at timestamptz not null default now(),
  preparando_at timestamptz,
  listo_at timestamptz,
  entregado_at timestamptz
);
create index pedidos_negocio_creado on public.pedidos (negocio_id, creado_at desc);
create index pedidos_cuenta on public.pedidos (cuenta_id);

create table public.items_pedido (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  producto_id uuid references public.productos (id) on delete set null,
  nombre_producto text not null,       -- copiado al momento del pedido
  cantidad int not null check (cantidad between 1 and 50),
  precio_unitario numeric(12, 2) not null, -- copiado al momento del pedido
  sabores text[] not null default '{}',
  nota text
);
create index items_pedido_pedido on public.items_pedido (pedido_id);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  cuenta_id uuid not null references public.cuentas (id) on delete cascade,
  monto numeric(12, 2) not null check (monto >= 0),
  medio text not null check (medio in ('efectivo', 'qr', 'tarjeta')),
  usuario_id uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Ayudantes ─────────────────────────

create or replace function public.mi_negocio() returns uuid
language sql stable security definer set search_path = public as $$
  select negocio_id from public.usuarios where id = auth.uid()
$$;

create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.usuarios where id = auth.uid()
$$;

-- Registra la hora de cada cambio de estado (alimenta el reporte de espera).
create or replace function public.tg_pedido_horas() returns trigger
language plpgsql as $$
begin
  if new.estado is distinct from old.estado then
    if new.estado = 'preparando' and new.preparando_at is null then new.preparando_at := now(); end if;
    if new.estado = 'listo' and new.listo_at is null then new.listo_at := now(); end if;
    if new.estado = 'entregado' and new.entregado_at is null then new.entregado_at := now(); end if;
  end if;
  return new;
end $$;
create trigger pedido_horas before update on public.pedidos
  for each row execute function public.tg_pedido_horas();

-- ───────────────────────── RLS ─────────────────────────

alter table public.negocios enable row level security;
alter table public.usuarios enable row level security;
alter table public.mesas enable row level security;
alter table public.cuentas enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.sabores enable row level security;
alter table public.pedidos enable row level security;
alter table public.items_pedido enable row level security;
alter table public.pagos enable row level security;

-- Todo el personal ve los datos de su negocio.
create policy negocio_ver on public.negocios for select to authenticated using (id = public.mi_negocio());
create policy negocio_editar on public.negocios for update to authenticated
  using (id = public.mi_negocio() and public.mi_rol() = 'duenio');

create policy usuarios_ver on public.usuarios for select to authenticated using (negocio_id = public.mi_negocio());
create policy usuarios_editar on public.usuarios for update to authenticated
  using (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio')
  with check (negocio_id = public.mi_negocio());
create policy usuarios_borrar on public.usuarios for delete to authenticated
  using (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio' and id <> auth.uid());

-- Carta y mesas: el dueño las administra; la barra puede marcar "sin stock" (update).
create policy mesas_ver on public.mesas for select to authenticated using (negocio_id = public.mi_negocio());
create policy mesas_duenio on public.mesas for all to authenticated
  using (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio')
  with check (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio');
create policy mesas_personal_update on public.mesas for update to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy categorias_ver on public.categorias for select to authenticated using (negocio_id = public.mi_negocio());
create policy categorias_duenio on public.categorias for all to authenticated
  using (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio')
  with check (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio');

create policy productos_ver on public.productos for select to authenticated using (negocio_id = public.mi_negocio());
create policy productos_duenio on public.productos for all to authenticated
  using (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio')
  with check (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio');

create policy sabores_ver on public.sabores for select to authenticated using (negocio_id = public.mi_negocio());
create policy sabores_duenio on public.sabores for all to authenticated
  using (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio')
  with check (negocio_id = public.mi_negocio() and public.mi_rol() = 'duenio');

create policy cuentas_ver on public.cuentas for select to authenticated using (negocio_id = public.mi_negocio());

create policy pedidos_ver on public.pedidos for select to authenticated using (negocio_id = public.mi_negocio());
create policy pedidos_update on public.pedidos for update to authenticated
  using (negocio_id = public.mi_negocio()) with check (negocio_id = public.mi_negocio());

create policy items_ver on public.items_pedido for select to authenticated using (negocio_id = public.mi_negocio());

create policy pagos_ver on public.pagos for select to authenticated using (negocio_id = public.mi_negocio());

-- Nadie borra ventas cerradas salvo vía funciones; no hay políticas de delete en pedidos/pagos.

-- ───────────────────────── "Sin stock" para la barra ─────────────────────────

create or replace function public.cambiar_disponible(p_tipo text, p_id uuid, p_disponible boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio();
begin
  if v_neg is null then raise exception 'sin_permiso'; end if;
  if p_tipo = 'producto' then
    update productos set disponible = p_disponible where id = p_id and negocio_id = v_neg;
  elsif p_tipo = 'sabor' then
    update sabores set disponible = p_disponible where id = p_id and negocio_id = v_neg;
  else
    raise exception 'tipo_invalido';
  end if;
end $$;

-- ───────────────────────── Alta de negocio y equipo ─────────────────────────

create or replace function public.crear_negocio(p_nombre text, p_mi_nombre text, p_con_demo boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_neg uuid;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if exists (select 1 from usuarios where id = auth.uid()) then raise exception 'ya_tiene_negocio'; end if;
  insert into negocios (nombre) values (trim(p_nombre)) returning id into v_neg;
  insert into usuarios (id, negocio_id, nombre, rol) values (auth.uid(), v_neg, trim(p_mi_nombre), 'duenio');
  if p_con_demo then perform public.cargar_carta_ejemplo(v_neg); end if;
  return v_neg;
end $$;

create or replace function public.unirse_a_negocio(p_codigo text, p_mi_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_neg uuid;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if exists (select 1 from usuarios where id = auth.uid()) then raise exception 'ya_tiene_negocio'; end if;
  select id into v_neg from negocios where codigo_equipo = upper(trim(p_codigo));
  if v_neg is null then raise exception 'codigo_invalido'; end if;
  -- Entra como mozo; el dueño puede cambiarle el rol desde el panel.
  insert into usuarios (id, negocio_id, nombre, rol) values (auth.uid(), v_neg, trim(p_mi_nombre), 'mozo');
  return v_neg;
end $$;

-- Carta de ejemplo para que el dueño vea el sistema funcionando en la primera visita.
create or replace function public.cargar_carta_ejemplo(p_negocio uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c_hel uuid; c_caf uuid; c_pas uuid;
begin
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Helados', 1) returning id into c_hel;
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Cafetería', 2) returning id into c_caf;
  insert into categorias (negocio_id, nombre, orden) values (p_negocio, 'Pastelería', 3) returning id into c_pas;

  insert into productos (negocio_id, categoria_id, nombre, descripcion, precio, max_sabores, orden) values
    (p_negocio, c_hel, 'Cucurucho', 'Hasta 2 sabores', 3500, 2, 1),
    (p_negocio, c_hel, 'Vasito 1/4 kg', 'Hasta 3 sabores', 6000, 3, 2),
    (p_negocio, c_hel, 'Copa helada', 'Helado, crema y salsa a elección', 8500, 3, 3),
    (p_negocio, c_caf, 'Café', null, 2800, 0, 1),
    (p_negocio, c_caf, 'Café con leche', null, 3300, 0, 2),
    (p_negocio, c_caf, 'Submarino', null, 4200, 0, 3),
    (p_negocio, c_caf, 'Licuado', 'Banana, frutilla o durazno', 5000, 0, 4),
    (p_negocio, c_pas, 'Medialunas x2', null, 2400, 0, 1),
    (p_negocio, c_pas, 'Croissant', null, 3000, 0, 2),
    (p_negocio, c_pas, 'Tostado de jamón y queso', null, 6500, 0, 3);

  insert into sabores (negocio_id, nombre) values
    (p_negocio, 'Dulce de leche'), (p_negocio, 'Dulce de leche granizado'),
    (p_negocio, 'Chocolate'), (p_negocio, 'Chocolate amargo'),
    (p_negocio, 'Frutilla'), (p_negocio, 'Limón'), (p_negocio, 'Vainilla'),
    (p_negocio, 'Sambayón'), (p_negocio, 'Menta granizada'), (p_negocio, 'Banana split');

  insert into mesas (negocio_id, numero) select p_negocio, g from generate_series(1, 8) g;
end $$;
revoke execute on function public.cargar_carta_ejemplo(uuid) from public, anon, authenticated;

-- ───────────────────────── Funciones del cliente (QR, sin cuenta) ─────────────────────────

create or replace function public.carta_mesa(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mesa mesas; v_res jsonb;
begin
  select * into v_mesa from mesas where codigo = p_codigo and activa;
  if not found then return null; end if;
  select jsonb_build_object(
    'negocio', (select nombre from negocios where id = v_mesa.negocio_id),
    'mesa', v_mesa.numero,
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre,
        'productos', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'precio', p.precio,
            'foto_url', p.foto_url, 'max_sabores', p.max_sabores) order by p.orden, p.nombre), '[]'::jsonb)
          from productos p where p.categoria_id = c.id and p.disponible)
      ) order by c.orden, c.nombre)
      from categorias c where c.negocio_id = v_mesa.negocio_id), '[]'::jsonb),
    'sabores', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre) order by s.nombre)
      from sabores s where s.negocio_id = v_mesa.negocio_id and s.disponible), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;

-- p_items: [{ "producto_id": uuid, "cantidad": int, "sabores": [uuid], "nota": text }]
create or replace function public.crear_pedido(p_codigo text, p_items jsonb, p_origen text default 'qr')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mesa mesas; v_cuenta uuid; v_pedido uuid; v_total numeric := 0;
  it jsonb; v_prod productos; v_cant int; v_sabores text[]; v_n_sab int; v_n_ok int;
begin
  if p_origen not in ('qr', 'mozo') then raise exception 'origen_invalido'; end if;
  if p_origen = 'mozo' and public.mi_negocio() is null then raise exception 'sin_permiso'; end if;
  select * into v_mesa from mesas where codigo = p_codigo and activa for update;
  if not found then raise exception 'mesa_invalida'; end if;
  if p_origen = 'mozo' and v_mesa.negocio_id <> public.mi_negocio() then raise exception 'sin_permiso'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'pedido_vacio'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'pedido_muy_grande'; end if;

  -- Antispam: máximo 5 pedidos por mesa cada 2 minutos desde el QR.
  if p_origen = 'qr' and (select count(*) from pedidos where mesa_id = v_mesa.id
      and creado_at > now() - interval '2 minutes') >= 5 then
    raise exception 'demasiados_pedidos';
  end if;

  select id into v_cuenta from cuentas where mesa_id = v_mesa.id and cerrada_at is null;
  if v_cuenta is null then
    insert into cuentas (negocio_id, mesa_id) values (v_mesa.negocio_id, v_mesa.id) returning id into v_cuenta;
  end if;

  insert into pedidos (negocio_id, mesa_id, cuenta_id, numero_mesa, origen)
  values (v_mesa.negocio_id, v_mesa.id, v_cuenta, v_mesa.numero, p_origen) returning id into v_pedido;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from productos
      where id = (it->>'producto_id')::uuid and negocio_id = v_mesa.negocio_id;
    if not found then raise exception 'producto_invalido'; end if;
    if not v_prod.disponible then raise exception 'sin_stock:%', v_prod.nombre; end if;
    v_cant := coalesce((it->>'cantidad')::int, 1);
    if v_cant < 1 or v_cant > 50 then raise exception 'cantidad_invalida'; end if;

    v_n_sab := coalesce(jsonb_array_length(it->'sabores'), 0);
    if v_n_sab > v_prod.max_sabores then raise exception 'demasiados_sabores:%', v_prod.nombre; end if;
    select array_agg(s.nombre order by s.nombre), count(*) into v_sabores, v_n_ok
      from sabores s
      where s.negocio_id = v_mesa.negocio_id and s.disponible
        and s.id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(it->'sabores', '[]')) x);
    if v_n_ok <> (select count(distinct x) from jsonb_array_elements(coalesce(it->'sabores', '[]')) x) then
      raise exception 'sabor_sin_stock';
    end if;

    insert into items_pedido (negocio_id, pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, sabores, nota)
    values (v_mesa.negocio_id, v_pedido, v_prod.id, v_prod.nombre, v_cant, v_prod.precio,
            coalesce(v_sabores, '{}'), nullif(left(trim(it->>'nota'), 200), ''));
    v_total := v_total + v_prod.precio * v_cant;
  end loop;

  update pedidos set total = v_total where id = v_pedido;
  update mesas set estado = case when estado = 'libre' then 'ocupada' else estado end where id = v_mesa.id;
  return v_pedido;
end $$;

-- Lo que ve el cliente después de pedir: sus pedidos de esta visita y el total.
create or replace function public.estado_mesa(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mesa mesas; v_cuenta uuid;
begin
  select * into v_mesa from mesas where codigo = p_codigo and activa;
  if not found then return null; end if;
  select id into v_cuenta from cuentas where mesa_id = v_mesa.id and cerrada_at is null;
  return jsonb_build_object(
    'mesa', v_mesa.numero,
    'estado_mesa', v_mesa.estado,
    'llamado', v_mesa.llamado_at is not null,
    'total', coalesce((select sum(total) from pedidos where cuenta_id = v_cuenta and estado <> 'cancelado'), 0),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'estado', p.estado, 'creado_at', p.creado_at, 'total', p.total,
        'items', (select jsonb_agg(jsonb_build_object('nombre', i.nombre_producto, 'cantidad', i.cantidad, 'sabores', i.sabores))
                  from items_pedido i where i.pedido_id = p.id)
      ) order by p.creado_at)
      from pedidos p where p.cuenta_id = v_cuenta), '[]'::jsonb)
  );
end $$;

-- p_motivo: 'mozo' (llamar al mozo) o 'cuenta' (pedir la cuenta)
create or replace function public.llamar_desde_mesa(p_codigo text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_motivo = 'cuenta' then
    update mesas set estado = 'pide_cuenta', llamado_at = coalesce(llamado_at, now())
      where codigo = p_codigo and activa and estado <> 'libre';
  elsif p_motivo = 'mozo' then
    update mesas set llamado_at = now() where codigo = p_codigo and activa;
  else
    raise exception 'motivo_invalido';
  end if;
end $$;

-- ───────────────────────── Cobro y cierre (mozo / dueño) ─────────────────────────

create or replace function public.cerrar_mesa(p_mesa uuid, p_medio text)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_mesa mesas; v_cuenta uuid; v_total numeric;
begin
  if public.mi_rol() not in ('mozo', 'duenio') then raise exception 'sin_permiso'; end if;
  select * into v_mesa from mesas where id = p_mesa and negocio_id = public.mi_negocio() for update;
  if not found then raise exception 'mesa_invalida'; end if;
  select id into v_cuenta from cuentas where mesa_id = p_mesa and cerrada_at is null;
  if v_cuenta is not null then
    select coalesce(sum(total), 0) into v_total from pedidos where cuenta_id = v_cuenta and estado <> 'cancelado';
    insert into pagos (negocio_id, cuenta_id, monto, medio, usuario_id)
      values (v_mesa.negocio_id, v_cuenta, v_total, p_medio, auth.uid());
    update pedidos set estado = 'entregado' where cuenta_id = v_cuenta and estado in ('nuevo', 'preparando', 'listo');
    update cuentas set cerrada_at = now() where id = v_cuenta;
  end if;
  update mesas set estado = 'libre', llamado_at = null where id = p_mesa;
  return coalesce(v_total, 0);
end $$;

-- ───────────────────────── Reporte del día ─────────────────────────

create or replace function public.reporte(p_desde timestamptz, p_hasta timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neg uuid := public.mi_negocio();
begin
  if public.mi_rol() <> 'duenio' then raise exception 'sin_permiso'; end if;
  return jsonb_build_object(
    'ventas', (select coalesce(sum(monto), 0) from pagos where negocio_id = v_neg and created_at between p_desde and p_hasta),
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
    'sabores', (select coalesce(jsonb_agg(x order by x.veces desc), '[]') from (
                   select s sabor, sum(i.cantidad) veces
                   from items_pedido i join pedidos p on p.id = i.pedido_id, unnest(i.sabores) s
                   where p.negocio_id = v_neg and p.estado <> 'cancelado' and p.creado_at between p_desde and p_hasta
                   group by s) x)
  );
end $$;

-- ───────────────────────── Permisos de ejecución ─────────────────────────

revoke execute on function public.crear_negocio(text, text, boolean) from public, anon;
revoke execute on function public.unirse_a_negocio(text, text) from public, anon;
revoke execute on function public.cerrar_mesa(uuid, text) from public, anon;
revoke execute on function public.reporte(timestamptz, timestamptz) from public, anon;
revoke execute on function public.cambiar_disponible(text, uuid, boolean) from public, anon;
grant execute on function public.crear_negocio(text, text, boolean) to authenticated;
grant execute on function public.unirse_a_negocio(text, text) to authenticated;
grant execute on function public.cerrar_mesa(uuid, text) to authenticated;
grant execute on function public.reporte(timestamptz, timestamptz) to authenticated;
grant execute on function public.cambiar_disponible(text, uuid, boolean) to authenticated;
grant execute on function public.carta_mesa(text) to anon, authenticated;
grant execute on function public.crear_pedido(text, jsonb, text) to anon, authenticated;
grant execute on function public.estado_mesa(text) to anon, authenticated;
grant execute on function public.llamar_desde_mesa(text, text) to anon, authenticated;

-- ───────────────────────── Tiempo real ─────────────────────────
-- La barra y el mapa de mesas escuchan cambios (RLS filtra por negocio).
alter publication supabase_realtime add table public.pedidos, public.mesas;
