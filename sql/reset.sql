-- WARNING: This script removes data for a single vault/project only.
-- Replace 'YOUR_VAULT_ID' with the vault/project you want to clear before running it.

DELETE FROM public.documents WHERE project_name = 'YOUR_VAULT_ID';
DELETE FROM public.obsidian_file_status WHERE vault_id = 'YOUR_VAULT_ID';
