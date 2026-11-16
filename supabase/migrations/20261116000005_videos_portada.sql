-- El almacenamiento acepta videos cortos para la portada (hasta 15 MB).
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime']
where id = 'imagenes';
