-- Napfpost – Grundschema
-- Kern: Eine Person erledigt eine Aufgabe (task_completions), alle anderen im Haushalt erfahren es.
-- Bereiche (Hund, Kind, Haushalt, Haustier) hängen an tasks.area; der Hund hat eine eigene Tabelle.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Zufallswerte
-- ---------------------------------------------------------------------------

create function public.random_code(len int) returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from extensions.gen_random_bytes(len) as b, generate_series(0, len - 1) as i
$$;

-- 16 Byte = 128 Bit, base64url ohne Padding → 22 Zeichen
create function public.random_token() returns text
language sql volatile set search_path = '' as $$
  select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_')
$$;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

-- Profil zu auth.users (Name, der in Nachrichten erscheint)
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  timezone text not null default 'Europe/Berlin',
  -- 8 Zeichen ohne verwechselbare Zeichen (0/O, 1/I/L); zum Beitreten weiterer Familienmitglieder
  invite_code text not null unique default public.random_code(8),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '🐶',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);
create index dogs_household_idx on public.dogs (household_id);

-- Eine wiederkehrende Aufgabe. area bestimmt den Bereich; dog_id ist bei area = 'dog' gesetzt.
-- Weitere Bereiche bekommen später eigene Spalten (z. B. child_id) nach demselben Muster.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  area text not null check (area in ('dog', 'child', 'household', 'pet')),
  dog_id uuid,
  kind text not null default 'custom' check (kind in ('feed', 'walk', 'water', 'meds', 'custom')),
  title text not null check (char_length(title) between 1 and 60),       -- „Füttern“
  emoji text not null default '✅',
  done_aux text not null default 'wurde',                                 -- „Bruno wurde gefüttert“
  done_word text not null default 'erledigt',                             -- „gefüttert“
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (dog_id, household_id) references public.dogs (id, household_id) on delete cascade,
  check ((area = 'dog') = (dog_id is not null))
);
create index tasks_household_idx on public.tasks (household_id);
create index tasks_dog_idx on public.tasks (dog_id);

-- Zeitfenster, z. B. Morgens 07:00–10:00. Ohne Zeitfenster gilt die Aufgabe einmal pro Tag.
create table public.task_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  task_id uuid not null,
  label text not null check (char_length(label) between 1 and 30),
  start_time time not null,
  end_time time not null,
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}',                -- ISO: 1 = Montag
  created_at timestamptz not null default now(),
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade,
  check (end_time > start_time),
  check (weekdays <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(weekdays) > 0)
);
create index task_schedules_task_idx on public.task_schedules (task_id);

-- Eine Erledigung. period_key identifiziert den Zeitraum (Tag + Zeitfenster).
-- Der Unique-Index verhindert eine zweite Erledigung im selben Zeitraum – auch bei gleichzeitigem Antippen.
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  task_id uuid not null,
  schedule_id uuid references public.task_schedules (id) on delete set null,
  period_key text not null check (period_key ~ '^\d{4}-\d{2}-\d{2}(#[0-9a-f-]{36})?$'),
  completed_by uuid references public.users (id) on delete set null,
  completed_at timestamptz not null default now(),
  source text not null default 'app' check (source in ('app', 'tag')),
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade,
  unique (task_id, period_key)
);
create index task_completions_household_idx on public.task_completions (household_id, completed_at desc);

-- Link für NFC-Tag und QR-Code: https://…/t/<token>. 128 Bit Zufall, nicht erratbar.
create table public.task_tokens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  task_id uuid not null,
  token text not null unique default public.random_token(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  foreign key (task_id, household_id) references public.tasks (id, household_id) on delete cascade
);
create index task_tokens_task_idx on public.task_tokens (task_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für RLS (security definer, damit die Policies nicht rekursiv werden)
-- ---------------------------------------------------------------------------

create function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  )
$$;

create function public.is_owner(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

create function public.shares_household(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = auth.uid() and b.user_id = other
  )
$$;

-- ---------------------------------------------------------------------------
-- Profil automatisch anlegen
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Ich'), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Haushalt anlegen / beitreten
-- ---------------------------------------------------------------------------

create function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  insert into public.households (name, created_by) values (trim(p_name), auth.uid()) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, auth.uid(), 'owner');
  return hid;
end;
$$;

create function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select id into hid from public.households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  insert into public.household_members (household_id, user_id) values (hid, auth.uid())
  on conflict do nothing;
  return hid;
end;
$$;

create function public.rotate_invite_code(p_household uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare code text;
begin
  if not public.is_owner(p_household) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.households set invite_code = public.random_code(8) where id = p_household returning invite_code into code;
  return code;
end;
$$;

-- Hund mit sinnvollen Standardaufgaben anlegen (läuft mit den Rechten des Aufrufers, RLS greift)
create function public.create_dog(p_household uuid, p_name text, p_emoji text default '🐶') returns uuid
language plpgsql security invoker set search_path = '' as $$
declare did uuid; feed uuid; walk uuid;
begin
  insert into public.dogs (household_id, name, emoji) values (p_household, trim(p_name), coalesce(p_emoji, '🐶'))
  returning id into did;

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

  return did;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.dogs enable row level security;
alter table public.tasks enable row level security;
alter table public.task_schedules enable row level security;
alter table public.task_completions enable row level security;
alter table public.task_tokens enable row level security;
alter table public.push_subscriptions enable row level security;

create policy users_select on public.users for select to authenticated
  using (id = auth.uid() or public.shares_household(id));
create policy users_update on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));
create policy members_delete on public.household_members for delete to authenticated
  using (user_id = auth.uid() or public.is_owner(household_id));

create policy dogs_all on public.dogs for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy tasks_all on public.tasks for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy schedules_all on public.task_schedules for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy tokens_all on public.task_tokens for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy completions_select on public.task_completions for select to authenticated
  using (public.is_member(household_id));
-- Eintragen nur im eigenen Haushalt und nur im eigenen Namen
create policy completions_insert on public.task_completions for insert to authenticated
  with check (public.is_member(household_id) and completed_by = auth.uid());
-- Versehentliches Antippen: die eigene Erledigung 15 Minuten lang zurücknehmen
create policy completions_delete on public.task_completions for delete to authenticated
  using (completed_by = auth.uid() and completed_at > now() - interval '15 minutes');

create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Erledigungen dürfen nicht nachträglich umgeschrieben werden
revoke update on public.task_completions from authenticated, anon;
revoke all on function public.create_household(text), public.join_household(text), public.rotate_invite_code(uuid) from anon, public;
grant execute on function public.create_household(text), public.join_household(text), public.rotate_invite_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: neue und gelöschte Erledigungen sofort an alle offenen Geräte
-- ---------------------------------------------------------------------------

alter table public.task_completions replica identity full;
alter publication supabase_realtime add table public.task_completions;
