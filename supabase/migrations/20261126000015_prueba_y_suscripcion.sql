-- Prueba gratis con vencimiento, días de gracia y suscripción mensual con Mercado Pago.
--
-- Situación de un local (la calcula public.situacion_local):
--   prueba      → dentro de los días de prueba gratis.
--   gracia      → la prueba (o el último pago por Mercado Pago) venció hace menos de "dias_gracia" días.
--   vencida     → pasaron los días de gracia: la carta QR se pausa y el dueño ve la pantalla de planes.
--   activo      → pagando (a mano, cargado por la administradora, o por Mercado Pago al día).
--   suspendido  → suspendido a mano por la administradora.

-- ── Ajustes de la plataforma (una sola fila). Los cambia la administradora en /admin. ──
create table public.plataforma_config (
  id int primary key default 1 check (id = 1),
  dias_prueba int not null default 14 check (dias_prueba between 1 and 90),
  dias_gracia int not null default 2 check (dias_gracia between 0 and 30),
  precio_basico numeric(12, 2) not null default 29900 check (precio_basico > 0),
  precio_premium numeric(12, 2) not null default 59900 check (precio_premium > 0),
  email_avisos text not null default 'agency.emuna@gmail.com',
  updated_at timestamptz not null default now()
);
insert into public.plataforma_config (id) values (1);
alter table public.plataforma_config enable row level security; -- sin políticas: se lee por funciones

create or replace function public.hoy_ar() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- ── Datos nuevos del local ──
alter table public.negocios add column prueba_hasta date;
alter table public.negocios add column mp_preapproval_id text unique;
alter table public.negocios add column mp_estado text;         -- pending, authorized, paused, cancelled (lo que diga Mercado Pago)
alter table public.negocios add column mp_plan text check (mp_plan in ('basico', 'premium'));
alter table public.negocios add column mp_email text;

-- Los locales que ya están en prueba arrancan sus días de prueba hoy, para no cortarle a nadie de golpe.
update public.negocios set prueba_hasta = public.hoy_ar() + (select dias_prueba from public.plataforma_config)
 where estado = 'prueba';

-- Cada local nuevo recibe su fecha de fin de prueba al crearse.
create or replace function public.poner_fin_de_prueba() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.prueba_hasta is null then
    new.prueba_hasta := public.hoy_ar() + (select dias_prueba from plataforma_config where id = 1);
  end if;
  return new;
end $$;
create trigger negocios_fin_de_prueba before insert on public.negocios
  for each row execute function public.poner_fin_de_prueba();

-- ── Situación del local ──
create or replace function public.situacion_local(p_negocio uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare n negocios; v_gracia int; v_pagado date; v_hoy date := public.hoy_ar();
begin
  select * into n from negocios where id = p_negocio;
  if not found then return null; end if;
  if n.estado = 'suspendido' then return 'suspendido'; end if;
  select dias_gracia into v_gracia from plataforma_config where id = 1;

  if n.estado = 'activo' then
    -- Solo los locales que pagan por Mercado Pago se vencen solos. Los que cobra la administradora a mano
    -- siguen como hasta ahora: ella los suspende si hace falta.
    if n.mp_preapproval_id is null then return 'activo'; end if;
    select pagado_hasta into v_pagado from admin_seguimiento where negocio_id = n.id;
    if v_pagado is null or v_hoy <= v_pagado then return 'activo'; end if;
    if v_hoy <= v_pagado + v_gracia then return 'gracia'; end if;
    return 'vencida';
  end if;

  -- En prueba
  if n.prueba_hasta is null or v_hoy <= n.prueba_hasta then return 'prueba'; end if;
  if v_hoy <= n.prueba_hasta + v_gracia then return 'gracia'; end if;
  return 'vencida';
end $$;

-- Plan que puede usar hoy: durante la prueba (y la gracia) se prueba el plan que pidió al registrarse.
create or replace function public.plan_vigente(p_negocio uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when n.plan = 'premium' then 'premium'
    when public.situacion_local(n.id) in ('prueba', 'gracia') and n.estado = 'prueba' and n.plan_solicitado = 'premium' then 'premium'
    else 'basico' end
  from negocios n where n.id = p_negocio
$$;

create or replace function public.puede_administrar() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios u where u.id = auth.uid() and u.rol = 'duenio'
                 and public.plan_vigente(u.negocio_id) = 'premium'
                 and public.situacion_local(u.negocio_id) not in ('vencida', 'suspendido'))
$$;

-- Lo que ve el dueño (y su equipo) sobre su cuenta.
create or replace function public.mi_suscripcion() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n negocios; c plataforma_config; v_pagado date; v_sit text;
begin
  select * into n from negocios where id = public.mi_negocio();
  if not found then raise exception 'sin_negocio'; end if;
  select * into c from plataforma_config where id = 1;
  select pagado_hasta into v_pagado from admin_seguimiento where negocio_id = n.id;
  v_sit := public.situacion_local(n.id);
  return jsonb_build_object(
    'situacion', v_sit,
    'plan', n.plan, 'plan_solicitado', n.plan_solicitado, 'plan_vigente', public.plan_vigente(n.id),
    'prueba_hasta', n.prueba_hasta,
    'dias_restantes', case when n.estado = 'prueba' then n.prueba_hasta - public.hoy_ar() end,
    'gracia_hasta', case when n.estado = 'prueba' then n.prueba_hasta + c.dias_gracia
                         when n.mp_preapproval_id is not null then v_pagado + c.dias_gracia end,
    'pagado_hasta', v_pagado,
    'mp_estado', n.mp_estado, 'mp_plan', n.mp_plan,
    'dias_prueba', c.dias_prueba, 'dias_gracia', c.dias_gracia,
    'precios', jsonb_build_object('basico', c.precio_basico, 'premium', c.precio_premium)
  );
end $$;

-- Lo público: días de prueba y precios (para la página de inicio y el registro).
create or replace function public.config_publica() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('dias_prueba', dias_prueba, 'dias_gracia', dias_gracia,
                            'precios', jsonb_build_object('basico', precio_basico, 'premium', precio_premium))
  from plataforma_config where id = 1
$$;

-- ── La carta QR se pausa con el local suspendido o con la prueba/pago vencido ──
create or replace function public.carta_mesa(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_nombre text; v_neg uuid;
begin
  select n.nombre, n.id into v_nombre, v_neg
  from mesas m join negocios n on n.id = m.negocio_id where m.codigo = p_codigo and m.activa;
  if not found then return null; end if;
  if public.situacion_local(v_neg) in ('suspendido', 'vencida') then
    return jsonb_build_object('suspendido', true, 'negocio', v_nombre);
  end if;
  return public.carta_mesa_interna(p_codigo);
end $$;

create or replace function public.crear_pedido(p_codigo text, p_items jsonb, p_origen text default 'qr') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_neg uuid;
begin
  select m.negocio_id into v_neg from mesas m where m.codigo = p_codigo;
  if v_neg is not null and public.situacion_local(v_neg) in ('suspendido', 'vencida') then
    raise exception 'local_suspendido';
  end if;
  return public.crear_pedido_interno(p_codigo, p_items, p_origen);
end $$;

-- ── Mercado Pago: lo usan solo las funciones del servidor (clave de servicio) ──

-- El dueño pidió suscribirse: se guarda la suscripción pendiente que creó Mercado Pago.
create or replace function public.mp_registrar_suscripcion(p_negocio uuid, p_preapproval text, p_plan text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_plan not in ('basico', 'premium') then raise exception 'plan_invalido'; end if;
  update negocios set mp_preapproval_id = p_preapproval, mp_estado = 'pending', mp_plan = p_plan, mp_email = p_email
   where id = p_negocio;
  if not found then raise exception 'local_invalido'; end if;
end $$;

-- Mercado Pago avisó un cambio: se copia el estado y, si está al día, se activa el plan.
-- p_proximo es la fecha del próximo cobro: hasta ahí queda pagado.
create or replace function public.mp_sincronizar(p_preapproval text, p_estado text, p_proximo date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n negocios; v_antes date; v_nuevo_pago boolean := false;
begin
  select * into n from negocios where mp_preapproval_id = p_preapproval for update;
  if not found then return null; end if;
  select pagado_hasta into v_antes from admin_seguimiento where negocio_id = n.id;

  if p_estado = 'authorized' then
    update negocios set estado = case when estado = 'suspendido' then estado else 'activo' end,
                        plan = coalesce(mp_plan, plan), mp_estado = p_estado
     where id = n.id;
    if p_proximo is not null then
      insert into admin_seguimiento (negocio_id, pagado_hasta) values (n.id, p_proximo)
      on conflict (negocio_id) do update set pagado_hasta = greatest(coalesce(admin_seguimiento.pagado_hasta, excluded.pagado_hasta), excluded.pagado_hasta), updated_at = now();
      v_nuevo_pago := v_antes is null or p_proximo > v_antes;
    end if;
  else
    -- Pausada o cancelada: sigue con lo que ya pagó hasta "pagado_hasta" y después entra en gracia.
    update negocios set mp_estado = p_estado where id = n.id;
  end if;

  -- Aviso a la administradora
  if v_nuevo_pago then
    insert into avisos (negocio_id, tipo, referencia) values (n.id, 'pago_admin', p_proximo::text) on conflict do nothing;
  elsif p_estado in ('cancelled', 'paused') and coalesce(n.mp_estado, '') <> p_estado then
    insert into avisos (negocio_id, tipo, referencia) values (n.id, 'baja_admin', p_estado || ':' || public.hoy_ar()) on conflict do nothing;
  end if;
  return jsonb_build_object('negocio', n.id, 'nuevo_pago', v_nuevo_pago);
end $$;

-- ── Avisos por email (los manda la función "avisos" con Resend) ──
-- Cada aviso se registra una sola vez por "referencia" (la fecha de fin de prueba, el pago, etc.).
create table public.avisos (
  id bigint generated always as identity primary key,
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  tipo text not null check (tipo in ('por_vencer', 'vencio', 'vencio_admin', 'pago_admin', 'baja_admin')),
  referencia text not null,
  creado_at timestamptz not null default now(),
  enviado_at timestamptz,
  unique (negocio_id, tipo, referencia)
);
alter table public.avisos enable row level security; -- sin políticas

-- Agrega los avisos que tocan hoy y devuelve todos los que faltan enviar, con los datos para el mail.
create or replace function public.avisos_pendientes() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hoy date := public.hoy_ar();
begin
  -- 3 días antes de que termine la prueba (al cliente)
  insert into avisos (negocio_id, tipo, referencia)
  select n.id, 'por_vencer', n.prueba_hasta::text from negocios n
   where n.estado = 'prueba' and n.prueba_hasta between v_hoy and v_hoy + 3
  on conflict do nothing;
  -- Terminó la prueba (al cliente y a la administradora). No se avisan pruebas vencidas hace más de una semana.
  insert into avisos (negocio_id, tipo, referencia)
  select n.id, t.tipo, n.prueba_hasta::text from negocios n cross join (values ('vencio'), ('vencio_admin')) t(tipo)
   where n.estado = 'prueba' and n.prueba_hasta < v_hoy and n.prueba_hasta >= v_hoy - 7
  on conflict do nothing;

  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'tipo', a.tipo, 'negocio', n.nombre, 'telefono', n.telefono,
      'plan_solicitado', n.plan_solicitado, 'mp_plan', n.mp_plan,
      'prueba_hasta', n.prueba_hasta, 'gracia_hasta', n.prueba_hasta + c.dias_gracia,
      'pagado_hasta', s.pagado_hasta, 'referencia', a.referencia,
      'email_duenio', d.email, 'duenio', d.nombre, 'email_admin', c.email_avisos,
      'precios', jsonb_build_object('basico', c.precio_basico, 'premium', c.precio_premium)) order by a.id)
    from avisos a
    join negocios n on n.id = a.negocio_id
    cross join plataforma_config c
    left join admin_seguimiento s on s.negocio_id = n.id
    left join lateral (
      select u.nombre, au.email from usuarios u join auth.users au on au.id = u.id
      where u.negocio_id = n.id and u.rol = 'duenio' order by u.created_at limit 1
    ) d on true
    where a.enviado_at is null and a.creado_at > now() - interval '7 days'), '[]'::jsonb);
end $$;

create or replace function public.marcar_aviso_enviado(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update avisos set enviado_at = now() where id = p_id
$$;

-- ── Administradora ──
create or replace function public.admin_config() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  return (select to_jsonb(c) - 'id' from plataforma_config c where id = 1);
end $$;

create or replace function public.admin_guardar_config(
  p_dias_prueba int, p_dias_gracia int, p_precio_basico numeric, p_precio_premium numeric, p_email_avisos text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  update plataforma_config set dias_prueba = p_dias_prueba, dias_gracia = p_dias_gracia,
    precio_basico = p_precio_basico, precio_premium = p_precio_premium,
    email_avisos = coalesce(nullif(trim(p_email_avisos), ''), email_avisos), updated_at = now()
   where id = 1;
end $$;

-- Extiende la prueba de un local (vuelve a "En prueba" si estaba vencida).
create or replace function public.admin_extender_prueba(p_negocio uuid, p_dias int)
returns date language plpgsql security definer set search_path = public as $$
declare v_hasta date;
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  if p_dias not between 1 and 90 then raise exception 'dias_invalidos'; end if;
  update negocios set estado = 'prueba', prueba_hasta = greatest(coalesce(prueba_hasta, public.hoy_ar()), public.hoy_ar()) + p_dias
   where id = p_negocio and estado <> 'activo'
   returning prueba_hasta into v_hasta;
  if not found then raise exception 'local_invalido'; end if;
  return v_hasta;
end $$;

create or replace function public.admin_locales() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'nombre', n.nombre, 'estado', n.estado, 'plan', n.plan, 'plan_solicitado', n.plan_solicitado, 'telefono', n.telefono, 'alta', n.created_at, 'logo_url', n.logo_url,
      'situacion', public.situacion_local(n.id), 'prueba_hasta', n.prueba_hasta,
      'mp_estado', n.mp_estado, 'mp_plan', n.mp_plan,
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

-- ── Permisos ──
revoke execute on function public.hoy_ar() from public, anon;
revoke execute on function public.poner_fin_de_prueba() from public, anon, authenticated;
revoke execute on function public.situacion_local(uuid) from public, anon, authenticated;
revoke execute on function public.plan_vigente(uuid) from public, anon, authenticated;
revoke execute on function public.mi_suscripcion() from public, anon;
revoke execute on function public.mp_registrar_suscripcion(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.mp_sincronizar(text, text, date) from public, anon, authenticated;
revoke execute on function public.avisos_pendientes() from public, anon, authenticated;
revoke execute on function public.marcar_aviso_enviado(bigint) from public, anon, authenticated;
revoke execute on function public.admin_config() from public, anon;
revoke execute on function public.admin_guardar_config(int, int, numeric, numeric, text) from public, anon;
revoke execute on function public.admin_extender_prueba(uuid, int) from public, anon;
grant execute on function public.hoy_ar() to authenticated;
grant execute on function public.mi_suscripcion() to authenticated;
grant execute on function public.config_publica() to anon, authenticated;
grant execute on function public.admin_config() to authenticated;
grant execute on function public.admin_guardar_config(int, int, numeric, numeric, text) to authenticated;
grant execute on function public.admin_extender_prueba(uuid, int) to authenticated;
grant execute on function public.carta_mesa(text) to anon, authenticated;
grant execute on function public.crear_pedido(text, jsonb, text) to anon, authenticated;

-- En Supabase las funciones de Mercado Pago y de avisos las usa la clave de servicio.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.mp_registrar_suscripcion(uuid, text, text, text) to service_role;
    grant execute on function public.mp_sincronizar(text, text, date) to service_role;
    grant execute on function public.avisos_pendientes() to service_role;
    grant execute on function public.marcar_aviso_enviado(bigint) to service_role;
  end if;
end $$;
