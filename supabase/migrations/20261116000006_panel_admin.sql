-- Panel de administración de la plataforma: solo lo ven las cuentas listadas en "administradores".
-- Permite ver todos los locales, su actividad, llevar notas y pagos, y suspender o reactivar.

create table public.administradores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.administradores enable row level security; -- sin políticas: nadie la lee por la API

-- Estado comercial del local. Lo cambia solo la administradora.
alter table public.negocios
  add column estado text not null default 'prueba' check (estado in ('prueba', 'activo', 'suspendido'));

-- Seguimiento privado de cada local (el dueño no lo ve).
create table public.admin_seguimiento (
  negocio_id uuid primary key references public.negocios (id) on delete cascade,
  contacto text,
  pagado_hasta date,
  notas text,
  updated_at timestamptz not null default now()
);
alter table public.admin_seguimiento enable row level security; -- sin políticas

-- El dueño solo puede editar la apariencia de su local: no su estado ni su plan.
revoke update on public.negocios from authenticated, anon;
grant update (nombre, direccion, logo_url, color, portada_url, portada_tipo) on public.negocios to authenticated;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.administradores where user_id = auth.uid())
$$;

create or replace function public.admin_locales() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'nombre', n.nombre, 'estado', n.estado, 'alta', n.created_at, 'logo_url', n.logo_url,
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

create or replace function public.admin_actualizar_local(
  p_negocio uuid, p_estado text, p_contacto text, p_pagado_hasta date, p_notas text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  update negocios set estado = p_estado where id = p_negocio;
  if not found then raise exception 'local_invalido'; end if;
  insert into admin_seguimiento (negocio_id, contacto, pagado_hasta, notas)
  values (p_negocio, nullif(trim(p_contacto), ''), p_pagado_hasta, nullif(trim(p_notas), ''))
  on conflict (negocio_id) do update
    set contacto = excluded.contacto, pagado_hasta = excluded.pagado_hasta, notas = excluded.notas, updated_at = now();
end $$;

revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.admin_locales() from public, anon;
revoke execute on function public.admin_actualizar_local(uuid, text, text, date, text) from public, anon;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.admin_locales() to authenticated;
grant execute on function public.admin_actualizar_local(uuid, text, text, date, text) to authenticated;

-- ── Local suspendido: la carta QR deja de funcionar ──
-- Las funciones originales pasan a ser internas y las públicas revisan el estado primero.

alter function public.carta_mesa(text) rename to carta_mesa_interna;
revoke execute on function public.carta_mesa_interna(text) from public, anon, authenticated;

create function public.carta_mesa(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_nombre text; v_estado text;
begin
  select n.nombre, n.estado into v_nombre, v_estado
  from mesas m join negocios n on n.id = m.negocio_id where m.codigo = p_codigo and m.activa;
  if not found then return null; end if;
  if v_estado = 'suspendido' then return jsonb_build_object('suspendido', true, 'negocio', v_nombre); end if;
  return public.carta_mesa_interna(p_codigo);
end $$;

alter function public.crear_pedido(text, jsonb, text) rename to crear_pedido_interno;
revoke execute on function public.crear_pedido_interno(text, jsonb, text) from public, anon, authenticated;

create function public.crear_pedido(p_codigo text, p_items jsonb, p_origen text default 'qr') returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from mesas m join negocios n on n.id = m.negocio_id
             where m.codigo = p_codigo and n.estado = 'suspendido') then
    raise exception 'local_suspendido';
  end if;
  return public.crear_pedido_interno(p_codigo, p_items, p_origen);
end $$;

grant execute on function public.carta_mesa(text) to anon, authenticated;
grant execute on function public.crear_pedido(text, jsonb, text) to anon, authenticated;
