-- Almacenamiento de imágenes (logos y fotos de productos). Solo existe en Supabase (esquema storage).
-- Cada local guarda sus archivos en la carpeta "<negocio_id>/..."; lectura pública para mostrarlas en la carta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy imagenes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes' and public.mi_rol() = 'duenio'
              and (storage.foldername(name))[1] = public.mi_negocio()::text);

create policy imagenes_reemplazar on storage.objects for update to authenticated
  using (bucket_id = 'imagenes' and public.mi_rol() = 'duenio'
         and (storage.foldername(name))[1] = public.mi_negocio()::text)
  with check (bucket_id = 'imagenes' and (storage.foldername(name))[1] = public.mi_negocio()::text);

create policy imagenes_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'imagenes' and public.mi_rol() = 'duenio'
         and (storage.foldername(name))[1] = public.mi_negocio()::text);

-- Necesario para borrar o reemplazar archivos propios desde la API.
create policy imagenes_ver_propias on storage.objects for select to authenticated
  using (bucket_id = 'imagenes' and (storage.foldername(name))[1] = public.mi_negocio()::text);
