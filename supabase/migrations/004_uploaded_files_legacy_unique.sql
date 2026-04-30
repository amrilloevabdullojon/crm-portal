create unique index if not exists uploaded_files_module_file_url_unique_idx
  on public.uploaded_files (module_id, file_url);
