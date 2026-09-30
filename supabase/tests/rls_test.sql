-- Szenario aus der Aufgabenstellung: Jolina und Gero im selben Haushalt, Mallory in einem fremden.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'jolina@example.de', '{"display_name":"Jolina"}'),
  ('00000000-0000-0000-0000-00000000000b', 'gero@example.de',   '{"display_name":"Gero"}'),
  ('00000000-0000-0000-0000-00000000000c', 'mallory@example.de', '{}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.create_household('Familie D') as hid \gset
select public.create_dog(:'hid', 'Bruno') as dog \gset
select id as feed from public.tasks where dog_id = :'dog' and kind = 'feed' \gset
select id as morning from public.task_schedules where task_id = :'feed' and label = 'Morgens' \gset
select invite_code from public.households where id = :'hid' \gset
select set_config('my.hid', :'hid', false), set_config('my.feed', :'feed', false), set_config('my.dog', :'dog', false) \gset x_
select count(*) = 3 as three_default_tasks from public.tasks where dog_id = :'dog';

-- Gero tritt mit Einladungscode bei
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.join_household(:'invite_code') = :'hid' as gero_joined;
select display_name from public.users order by display_name;

-- Jolina füttert (08:42), Gero versucht es danach im selben Zeitfenster → Unique verhindert zweiten Eintrag
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.task_completions (household_id, task_id, schedule_id, period_key, completed_by, source)
values (:'hid', :'feed', :'morning', '2026-09-30#' || :'morning', '00000000-0000-0000-0000-00000000000a', 'app');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  insert into public.task_completions (household_id, task_id, schedule_id, period_key, completed_by, source)
  select household_id, task_id, schedule_id, period_key, auth.uid(), 'tag' from public.task_completions limit 1;
  raise exception 'FEHLER: zweite Erledigung wurde gespeichert';
exception when unique_violation then raise notice 'ok: zweite Erledigung abgelehnt';
end $$;
select count(*) = 1 as one_completion from public.task_completions;

-- Gero darf nicht im Namen von Jolina eintragen
do $$ begin
  insert into public.task_completions (household_id, task_id, period_key, completed_by)
  select household_id, id, '2026-09-30', '00000000-0000-0000-0000-00000000000a' from public.tasks where kind = 'water';
  raise exception 'FEHLER: fremder Name akzeptiert';
exception when insufficient_privilege then raise notice 'ok: nur im eigenen Namen';
end $$;

-- Gero darf Jolinas Erledigung nicht löschen, Update ist verboten
delete from public.task_completions;
select count(*) = 1 as still_one from public.task_completions;
do $$ begin
  update public.task_completions set completed_by = auth.uid();
  raise exception 'FEHLER: update erlaubt';
exception when insufficient_privilege then raise notice 'ok: kein update';
end $$;

-- Mallory (fremder Haushalt) sieht nichts und kann nichts eintragen
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select public.create_household('Fremd') as other \gset
select set_config('my.other', :'other', false) \gset x_
select count(*) = 0 as sees_no_foreign_tasks from public.tasks where household_id = :'hid';
select count(*) = 0 as sees_no_foreign_completions from public.task_completions;
select count(*) = 0 as sees_no_foreign_users from public.users where display_name in ('Jolina','Gero');
do $$ begin
  insert into public.task_completions (household_id, task_id, period_key, completed_by)
  values (current_setting('my.hid')::uuid, current_setting('my.feed')::uuid, '2026-09-30', auth.uid());
  raise exception 'FEHLER: fremder Haushalt';
exception when insufficient_privilege or undefined_object then raise notice 'ok: fremder Haushalt abgelehnt';
end $$;
-- Mallory kann einem eigenen Task keinen fremden Hund unterschieben (zusammengesetzter Fremdschlüssel)
do $$ begin
  insert into public.tasks (household_id, area, dog_id, title)
  values (current_setting('my.other')::uuid, 'dog', current_setting('my.dog')::uuid, 'x');
  raise exception 'FEHLER: fremder Hund verknüpft';
exception when foreign_key_violation or undefined_object then raise notice 'ok: fremder Hund abgelehnt';
end $$;

-- Token: zufällig, 22 Zeichen, nur für Mitglieder auflösbar
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.task_tokens (household_id, task_id) values (:'hid', :'feed') returning token \gset
select length(:'token') = 22 and :'token' ~ '^[A-Za-z0-9_-]+$' as token_format;
select count(*) = 1 as member_resolves from public.task_tokens where token = :'token';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select count(*) = 0 as stranger_cannot_resolve from public.task_tokens where token = :'token';

-- Jolina darf ihre eigene Erledigung zurücknehmen
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
delete from public.task_completions where completed_by = auth.uid();
select count(*) = 0 as undo_works from public.task_completions;
reset role;
