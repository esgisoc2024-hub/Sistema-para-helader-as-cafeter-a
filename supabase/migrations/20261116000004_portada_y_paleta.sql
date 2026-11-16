-- Portada del local (foto o video corto) arriba de la carta, y nueva paleta por defecto.

alter table public.negocios add column portada_url text;
alter table public.negocios add column portada_tipo text check (portada_tipo in ('imagen', 'video'));

-- Nuevo rojo frutilla por defecto; los locales que tenían el color viejo por defecto pasan al nuevo.
alter table public.negocios alter column color set default '#c8203f';
update public.negocios set color = '#c8203f' where lower(color) = '#d94a64';

-- La carta del cliente recibe la portada.
create or replace function public.carta_mesa(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mesa mesas; v_neg negocios; v_res jsonb;
begin
  select * into v_mesa from mesas where codigo = p_codigo and activa;
  if not found then return null; end if;
  select * into v_neg from negocios where id = v_mesa.negocio_id;
  select jsonb_build_object(
    'negocio', v_neg.nombre,
    'logo_url', v_neg.logo_url,
    'color', v_neg.color,
    'portada_url', v_neg.portada_url,
    'portada_tipo', v_neg.portada_tipo,
    'mesa', v_mesa.numero,
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
      from categorias c where c.negocio_id = v_mesa.negocio_id), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;
