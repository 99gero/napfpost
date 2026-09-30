-- Napfpost – Haustier (Hund oder Katze) und Familienbereich
-- Reihenfolge: nach 20260930000000_init.sql und 20260930000100_chips.sql ausführen.
-- Idempotent gebaut (if not exists / create or replace / drop … if exists): mehrfaches Ausführen ist unschädlich.
--
-- Teil A: Haustier. Die Tabelle heißt aus Kompatibilitätsgründen weiter `dogs` (Route /hund, Spalte dog_id).
-- Teil B: Familienbereich (Haushalt umbenennen, Mitglieder verwalten, verlassen, löschen, Benachrichtigungen).

-- ---------------------------------------------------------------------------
-- Teil A: Haustier
-- ---------------------------------------------------------------------------

-- Art des Haustiers. Bestehende Zeilen sind Hunde (Default).
alter table public.dogs
  add column if not exists species text not null default 'dog' check (species in ('dog', 'cat'));

-- Haustier mit artspezifischen Standardaufgaben anlegen (läuft mit den Rechten des Aufrufers, RLS greift).
-- Ersetzt create_dog(uuid, text, text) aus der Grundmigration; ohne p_species entsteht wie bisher ein Hund.
-- Die Aufgaben-Bereiche bleiben area = 'dog' (Tabellen-/Bereichsname historisch; die Prüfung
-- (area = 'dog') = (dog_id is not null) verlangt es).
drop function if exists public.create_dog(uuid, text, text);
create or replace function public.create_dog(
  p_household uuid, p_name text, p_emoji text default null, p_species text default 'dog'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare did uuid; feed uuid; walk uuid; sp text := coalesce(p_species, 'dog');
begin
  if sp not in ('dog', 'cat') then raise exception 'invalid species' using errcode = '22023'; end if;

  insert into public.dogs (household_id, name, emoji, species)
  values (p_household, trim(p_name), coalesce(nullif(trim(p_emoji), ''), case when sp = 'cat' then '🐱' else '🐶' end), sp)
  returning id into did;

  if sp = 'dog' then
    insert into public.tasks (household_id, area, dog_id, kind, title, emoji, done_aux, done_word, sort)
    values (p_household, 'dog', did, 'feed', 'Füttern', '🍖', 'wurde', 'gefüttert', 0) returning id into feed;
    insert into public.task_schedules (household_id, task_id, label, start_time, end_time) values
      (p_household, feed, 'Morgens', '07:00', '10:00'),
      (p_household, feed, 'Abends', '17:00', '21:00');

    insert into public.tasks (household_id, area, dog_id, kind, title, emoji, done_aux, done_word, sort)
    values (p_household, 'dog', did, 'walk', 'Gassi', '🦮', 'war', 'Gassi', 1) returning id into walk;
    insert into public.task_schedules (household_id, task_id, label, start_time, end_time) values
      (p_household, walk, 'Morgens', '06:00', '09:00'),
      (p_household, walk, 'Abends', '18:00', '22:00');

    insert into public.tasks (household_id, area, dog_id, kind, title, emoji, done_aux, done_word, sort)
    values (p_household, 'dog', did, 'water', 'Frisches Wasser', '💧', 'hat', 'frisches Wasser bekommen', 2);
  else
    insert into public.tasks (household_id, area, dog_id, kind, title, emoji, done_aux, done_word, sort)
    values (p_household, 'dog', did, 'feed', 'Füttern', '🐟', 'wurde', 'gefüttert', 0) returning id into feed;
    insert into public.task_schedules (household_id, task_id, label, start_time, end_time) values
      (p_household, feed, 'Morgens', '07:00', '10:00'),
      (p_household, feed, 'Abends', '17:00', '21:00');

    insert into public.tasks (household_id, area, dog_id, kind, title, emoji, done_aux, done_word, sort)
    values (p_household, 'dog', did, 'water', 'Frisches Wasser', '💧', 'hat', 'frisches Wasser bekommen', 1);

    insert into public.tasks (household_id, area, dog_id, kind, title, emoji, done_aux, done_word, sort)
    values (p_household, 'dog', did, 'custom', 'Katzenklo', '🧹', 'hat', 'ein sauberes Katzenklo bekommen', 2);
  end if;

  return did;
end;
$$;

revoke all on function public.create_dog(uuid, text, text, text) from anon, public;
grant execute on function public.create_dog(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Teil B: Familienbereich
-- ---------------------------------------------------------------------------

-- Push pro Person und Haushalt ein- oder ausschalten (die Geräte-Registrierung bleibt in push_subscriptions)
alter table public.household_members
  add column if not exists notify boolean not null default true;

-- Mitgliedschaften ändern Nutzer nicht mehr direkt (weder löschen noch Rolle setzen), sondern nur über die
-- Funktionen unten. Sonst könnte sich der letzte Besitzer per DELETE selbst entfernen und den Haushalt ohne Besitzer lassen.
drop policy if exists members_delete on public.household_members;
revoke insert, update, delete on public.household_members from anon, authenticated;

-- Hilfsfunktion: prüft, dass der Aufrufer Besitzer ist, sperrt alle Besitzer-Zeilen des Haushalts
-- (gegen gleichzeitiges Herabstufen/Entfernen zweier Besitzer) und liefert die Zahl der Besitzer.
-- Die Besitzerprüfung läuft nach dem Sperren noch einmal, falls die Rolle inzwischen entzogen wurde.
create or replace function public.lock_household_owners(hid uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_owner(hid) then raise exception 'forbidden' using errcode = '42501'; end if;
  select count(*)::int into n from (
    select 1 from public.household_members where household_id = hid and role = 'owner' for update
  ) s;
  if not public.is_owner(hid) then raise exception 'forbidden' using errcode = '42501'; end if;
  return n;
end;
$$;
revoke all on function public.lock_household_owners(uuid) from anon, authenticated, public;

-- Haushalt umbenennen (nur Besitzer)
create or replace function public.rename_household(p_household uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare n text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_owner(p_household) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(n) not between 1 and 60 then raise exception 'invalid name' using errcode = '22023'; end if;
  update public.households set name = n where id = p_household;
end;
$$;

-- Push für diesen Haushalt an/aus (nur die eigene Zeile)
create or replace function public.set_notify(p_household uuid, p_notify boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.household_members set notify = coalesce(p_notify, true)
  where household_id = p_household and user_id = auth.uid();
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
end;
$$;

-- Rolle eines Mitglieds setzen (nur Besitzer): weiteren Besitzer ernennen oder Besitzer zum Mitglied machen.
-- Der letzte Besitzer kann nicht herabgestuft werden, auch nicht durch sich selbst.
create or replace function public.set_member_role(p_household uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare owners int; cur text;
begin
  if p_role is null or p_role not in ('owner', 'member') then raise exception 'invalid role' using errcode = '22023'; end if;
  owners := public.lock_household_owners(p_household);
  select role into cur from public.household_members where household_id = p_household and user_id = p_user;
  if cur is null then raise exception 'member not found' using errcode = 'P0002'; end if;
  if cur = 'owner' and p_role = 'member' and owners <= 1 then
    raise exception 'last owner' using errcode = 'P0001';
  end if;
  update public.household_members set role = p_role where household_id = p_household and user_id = p_user;
end;
$$;

-- Besitzer-Rolle übertragen: das Mitglied wird Besitzer, der Aufrufer wird Mitglied (nur Besitzer)
create or replace function public.transfer_ownership(p_household uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_household_owners(p_household);
  if p_user = auth.uid() then raise exception 'invalid target' using errcode = '22023'; end if;
  if not exists (select 1 from public.household_members where household_id = p_household and user_id = p_user) then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  update public.household_members set role = 'owner' where household_id = p_household and user_id = p_user;
  update public.household_members set role = 'member' where household_id = p_household and user_id = auth.uid();
end;
$$;

-- Mitglied entfernen (nur Besitzer). Sich selbst entfernt man mit leave_household.
create or replace function public.remove_member(p_household uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_household_owners(p_household);
  if p_user = auth.uid() then raise exception 'use leave_household' using errcode = 'P0001'; end if;
  delete from public.household_members where household_id = p_household and user_id = p_user;
  if not found then raise exception 'member not found' using errcode = 'P0002'; end if;
end;
$$;

-- Haushalt verlassen (jedes Mitglied). Der letzte Besitzer darf nicht gehen:
-- gibt es weitere Mitglieder, muss er die Rolle vorher übertragen ('last owner');
-- ist er allein, muss er den Haushalt löschen ('sole member').
create or replace function public.leave_household(p_household uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r text; owners int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select role into r from public.household_members where household_id = p_household and user_id = auth.uid();
  if r is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if r = 'owner' then
    owners := public.lock_household_owners(p_household);
    if owners <= 1 then
      if exists (select 1 from public.household_members where household_id = p_household and user_id <> auth.uid()) then
        raise exception 'last owner' using errcode = 'P0001';
      end if;
      raise exception 'sole member' using errcode = 'P0001';
    end if;
  end if;
  delete from public.household_members where household_id = p_household and user_id = auth.uid();
end;
$$;

-- Haushalt löschen (nur Besitzer, Name muss übereinstimmen). Die Fremdschlüssel löschen Haustiere, Aufgaben,
-- Zeitfenster, Erledigungen, Tokens, Chips, Chip-Dateien und Mitgliedschaften mit.
-- Rückgabe: Pfade der Dateien im Storage-Bucket chip-files. Storage-Objekte lassen sich nicht per SQL löschen
-- (Supabase sperrt DELETE auf storage.objects); die App-Route /api/household/delete entfernt sie mit dem
-- Secret-Key über die Storage-API.
create or replace function public.delete_household(p_household uuid, p_confirm_name text) returns text[]
language plpgsql security definer set search_path = '' as $$
declare hname text; paths text[]; extra text[];
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_owner(p_household) then raise exception 'forbidden' using errcode = '42501'; end if;
  select name into hname from public.households where id = p_household for update;
  if hname is null then raise exception 'household not found' using errcode = 'P0002'; end if;
  if trim(coalesce(p_confirm_name, '')) <> hname then raise exception 'name mismatch' using errcode = 'P0001'; end if;

  select coalesce(array_agg(path), '{}') into paths from public.chip_files where household_id = p_household;
  -- Zusätzlich Objekte ohne Metadaten-Zeile (z. B. abgebrochener Upload), falls Storage vorhanden ist
  if to_regclass('storage.objects') is not null then
    begin
      execute format('select coalesce(array_agg(name), ''{}'') from storage.objects where bucket_id = %L and name like %L',
        'chip-files', p_household::text || '/%') into extra;
      paths := array(select distinct p from unnest(paths || extra) as p);
    exception when insufficient_privilege or undefined_table or undefined_column then
      null; -- dann bleiben nur die Pfade aus chip_files
    end;
  end if;

  delete from public.households where id = p_household;
  return paths;
end;
$$;

revoke all on function
  public.rename_household(uuid, text), public.set_notify(uuid, boolean), public.set_member_role(uuid, uuid, text),
  public.transfer_ownership(uuid, uuid), public.remove_member(uuid, uuid), public.leave_household(uuid),
  public.delete_household(uuid, text)
  from anon, public;
grant execute on function
  public.rename_household(uuid, text), public.set_notify(uuid, boolean), public.set_member_role(uuid, uuid, text),
  public.transfer_ownership(uuid, uuid), public.remove_member(uuid, uuid), public.leave_household(uuid),
  public.delete_household(uuid, text)
  to authenticated;
