-- Napfpost – Chip-System
-- Vorprogrammierte NFC-Chips tragen einen festen Link https://<App>/c/<code>. Was der Chip tut, steht hier in der
-- Datenbank und ist jederzeit änderbar; der Chip selbst wird nie neu beschrieben.
--
-- Freie Chips (status 'frei', ohne Haushalt) sind für Nutzer unsichtbar: Es gibt keine Policy dafür. Sie werden nur
-- serverseitig mit dem Secret-Key aufgelöst (/c/<code>) und dort aktiviert. Neue Chips legt der Betreiber im
-- SQL Editor an (siehe scripts/generate-chip-codes.mjs).

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.chips (
  id uuid primary key default gen_random_uuid(),
  -- 10 Zeichen aus A-Z a-z 0-9 _ - (60 Bit, kryptografisch zufällig erzeugt), im Link /c/<code>
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{10}$'),
  batch text check (batch is null or char_length(batch) between 1 and 40),
  status text not null default 'frei' check (status in ('frei', 'aktiv', 'gesperrt')),
  household_id uuid references public.households (id) on delete cascade,
  target_type text check (target_type in ('task', 'note', 'file', 'link', 'contact')),
  -- task: tasks.id. Wird die Aufgabe gelöscht, bleibt der Chip bestehen und zeigt „Ziel nicht mehr vorhanden“.
  target_id uuid,
  -- note: Text · link: http(s)-Adresse · contact: JSON {name, phone, phone2, note} · file/task: leer
  target_value text,
  title text check (char_length(title) between 1 and 60),
  -- 'members': nur angemeldete Mitglieder des Haushalts · 'public': jeder mit dem Link
  visibility text not null default 'members' check (visibility in ('members', 'public')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  unique (id, household_id),
  foreign key (target_id, household_id) references public.tasks (id, household_id) on delete set null (target_id),

  constraint chips_frei_shape check (status <> 'frei' or (
    household_id is null and target_type is null and target_id is null and target_value is null
    and title is null and activated_at is null and revoked_at is null)),
  constraint chips_aktiv_shape check (status <> 'aktiv' or (
    household_id is not null and target_type is not null and title is not null
    and activated_at is not null and revoked_at is null)),
  constraint chips_gesperrt_shape check (status <> 'gesperrt' or revoked_at is not null),
  -- Aufgaben erledigt nur, wer angemeldet ist
  constraint chips_task_members_only check (target_type is distinct from 'task' or visibility = 'members'),
  constraint chips_target_id_only_task check (target_type = 'task' or target_id is null),
  constraint chips_note_value check (target_type is distinct from 'note'
    or coalesce(char_length(target_value), 0) between 1 and 2000),
  constraint chips_link_value check (target_type is distinct from 'link'
    or coalesce(target_value ~* '^https?://[^[:space:]]+$' and char_length(target_value) <= 2000, false)),
  constraint chips_contact_value check (target_type is distinct from 'contact'
    or coalesce(char_length(target_value), 0) between 2 and 2000)
);
create index chips_household_idx on public.chips (household_id) where household_id is not null;

-- Metadaten der Datei, die zu einem Chip vom Typ 'file' gehört (Bucket chip-files). Eine Datei pro Chip.
create table public.chip_files (
  id uuid primary key default gen_random_uuid(),
  chip_id uuid not null unique,
  household_id uuid not null,
  path text not null unique,                                  -- <household_id>/<chip_id>/<uuid>.<endung>
  filename text not null check (char_length(filename) between 1 and 200),
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),   -- 5 MB
  created_at timestamptz not null default now(),
  foreign key (chip_id, household_id) references public.chips (id, household_id) on delete cascade,
  check (split_part(path, '/', 1) = household_id::text)
);

-- Kontingent im Free-Tarif (Supabase Storage: 1 GB gesamt): höchstens 25 MB Chip-Dateien pro Haushalt
create function public.chip_files_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare used bigint;
begin
  select coalesce(sum(size_bytes), 0) into used
  from public.chip_files where household_id = new.household_id and id <> new.id;
  if used + new.size_bytes > 26214400 then
    raise exception 'chip file quota exceeded' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger chip_files_quota
  before insert or update of size_bytes on public.chip_files
  for each row execute function public.chip_files_quota();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.chips enable row level security;
alter table public.chip_files enable row level security;

-- Nur aktivierte bzw. gesperrte Chips des eigenen Haushalts. Freie Chips (household_id null) sind nie sichtbar.
create policy chips_select on public.chips for select to authenticated
  using (household_id is not null and public.is_member(household_id));
-- Ändern darf man nur aktive Chips des eigenen Haushalts, und nur die per Spaltenrecht freigegebenen Spalten.
create policy chips_update on public.chips for update to authenticated
  using (household_id is not null and status = 'aktiv' and public.is_member(household_id))
  with check (household_id is not null and status = 'aktiv' and public.is_member(household_id));
-- Kein insert/delete für Nutzer: Chips entstehen im SQL Editor, aktiviert wird serverseitig.

revoke all on public.chips from anon, authenticated;
grant select on public.chips to authenticated;
grant update (target_type, target_id, target_value, title, visibility) on public.chips to authenticated;

create policy chip_files_all on public.chip_files for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
revoke all on public.chip_files from anon;

-- Sperren ist eine Statusänderung und läuft deshalb über eine Funktion (status ist nicht direkt änderbar)
create function public.block_chip(p_chip uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.chips set status = 'gesperrt', revoked_at = now()
  where id = p_chip and status = 'aktiv' and public.is_member(household_id);
  if not found then raise exception 'chip not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.block_chip(uuid) from anon, public;
grant execute on function public.block_chip(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: privater Bucket chip-files, Pfad <household_id>/<chip_id>/<datei>
-- Nur wenn Storage vorhanden ist (die lokale Entwicklungsumgebung startet ohne storage-api).
-- ---------------------------------------------------------------------------

create function public.chip_file_household(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

do $storage$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets fehlt – Bucket chip-files und Storage-Policies übersprungen';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('chip-files', 'chip-files', false, 5242880,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain'])
  on conflict (id) do update set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute $p$create policy chip_files_obj_select on storage.objects for select to authenticated
    using (bucket_id = 'chip-files' and public.is_member(public.chip_file_household(name)))$p$;
  execute $p$create policy chip_files_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'chip-files' and public.is_member(public.chip_file_household(name)))$p$;
  execute $p$create policy chip_files_obj_update on storage.objects for update to authenticated
    using (bucket_id = 'chip-files' and public.is_member(public.chip_file_household(name)))
    with check (bucket_id = 'chip-files' and public.is_member(public.chip_file_household(name)))$p$;
  execute $p$create policy chip_files_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'chip-files' and public.is_member(public.chip_file_household(name)))$p$;
end
$storage$;
