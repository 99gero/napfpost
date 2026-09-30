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
