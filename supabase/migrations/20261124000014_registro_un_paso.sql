-- Registro en un paso (estilo "crear cuenta"): teléfono del local y plan que pidió al registrarse.
-- El plan pedido NO activa Premium: lo activa la administradora desde "Mis locales".

alter table public.negocios add column telefono text;
alter table public.negocios add column plan_solicitado text check (plan_solicitado in ('basico', 'premium'));
grant update (telefono) on public.negocios to authenticated;

drop function public.crear_negocio(text, text, boolean);
create function public.crear_negocio(p_nombre text, p_mi_nombre text, p_con_demo boolean default true,
  p_telefono text default null, p_plan_solicitado text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_neg uuid;
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if exists (select 1 from usuarios where id = auth.uid()) then raise exception 'ya_tiene_negocio'; end if;
  insert into negocios (nombre, telefono, plan_solicitado)
  values (trim(p_nombre), nullif(trim(p_telefono), ''),
          case when p_plan_solicitado in ('basico', 'premium') then p_plan_solicitado end)
  returning id into v_neg;
  insert into usuarios (id, negocio_id, nombre, rol) values (auth.uid(), v_neg, trim(p_mi_nombre), 'duenio');
  if p_con_demo then perform public.cargar_carta_ejemplo(v_neg); end if;
  return v_neg;
end $$;
revoke execute on function public.crear_negocio(text, text, boolean, text, text) from public, anon;
grant execute on function public.crear_negocio(text, text, boolean, text, text) to authenticated;

-- "Mis locales" muestra el teléfono y el plan que pidió cada local.
create or replace function public.admin_locales() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'sin_permiso'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'nombre', n.nombre, 'estado', n.estado, 'plan', n.plan, 'plan_solicitado', n.plan_solicitado, 'telefono', n.telefono, 'alta', n.created_at, 'logo_url', n.logo_url,
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
