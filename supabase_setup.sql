-- ══════════════════════════════════════════════════════
-- CONNEXUS — Supabase Database Setup
-- Run this entire file in Supabase → SQL Editor → New Query
-- ══════════════════════════════════════════════════════

-- 1. UNIVERSITIES
create table if not exists universities (
  id text primary key,
  name text not null,
  short_name text not null,
  city text default 'India',
  established text default '',
  accent text default '#8B6A3E',
  members integer default 1,
  created_at timestamptz default now()
);

-- 2. PROFILES (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  university_id text references universities(id),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Student'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 3. LISTINGS (Marketplace items)
create table if not exists listings (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  uni_id text references universities(id),
  title text not null,
  category text not null,
  price integer not null,
  condition text default 'Good',
  description text default '',
  seller_name text not null,
  dept text default '',
  status text default 'active',
  created_at timestamptz default now()
);

-- 4. RIDES
create table if not exists rides (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  uni_id text references universities(id),
  driver text not null,
  from_location text not null,
  to_location text not null,
  ride_date text not null,
  ride_time text not null,
  seats integer not null,
  cost integer not null,
  status text default 'active',
  created_at timestamptz default now()
);

-- 5. INTERESTS (buyer/rider expresses interest)
create table if not exists interests (
  id bigserial primary key,
  from_user_id uuid references profiles(id) on delete cascade,
  from_name text not null,
  listing_id bigint references listings(id) on delete cascade,
  ride_id bigint references rides(id) on delete cascade,
  type text not null, -- 'marketplace' or 'ride'
  message text not null,
  contact text default '',
  status text default 'pending', -- 'pending' | 'seen' | 'connected'
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (keeps data safe)
-- ══════════════════════════════════════════════════════

alter table universities enable row level security;
alter table profiles enable row level security;
alter table listings enable row level security;
alter table rides enable row level security;
alter table interests enable row level security;

-- Universities: anyone can read, only authenticated can create
create policy "Anyone can read universities" on universities for select using (true);
create policy "Auth users can create universities" on universities for insert with check (auth.role() = 'authenticated');

-- Profiles: users can read all, only edit own
create policy "Anyone can read profiles" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Listings: anyone can read, only owner can insert/update/delete
create policy "Anyone can read listings" on listings for select using (true);
create policy "Auth users can create listings" on listings for insert with check (auth.uid() = user_id);
create policy "Owners can update listings" on listings for update using (auth.uid() = user_id);
create policy "Owners can delete listings" on listings for delete using (auth.uid() = user_id);

-- Rides: same as listings
create policy "Anyone can read rides" on rides for select using (true);
create policy "Auth users can create rides" on rides for insert with check (auth.uid() = user_id);
create policy "Owners can update rides" on rides for update using (auth.uid() = user_id);
create policy "Owners can delete rides" on rides for delete using (auth.uid() = user_id);

-- Interests: from_user can insert, listing/ride owner can read
create policy "Auth users can create interests" on interests for insert with check (auth.uid() = from_user_id);
create policy "Anyone can read interests" on interests for select using (true);
create policy "From user can update own interests" on interests for update using (auth.uid() = from_user_id);

-- ══════════════════════════════════════════════════════
-- SEED: Universities (same as your hardcoded data)
-- ══════════════════════════════════════════════════════

insert into universities (id, name, short_name, city, established, accent, members) values
  ('vjti', 'Veermata Jijabai Technological Institute', 'VJTI Mumbai', 'Mumbai', '1887', '#6366F1', 1842),
  ('ict',  'Institute of Chemical Technology',         'ICT Mumbai',  'Mumbai', '1933', '#10B981', 934),
  ('iitb', 'Indian Institute of Technology Bombay',    'IIT Bombay',  'Mumbai', '1958', '#8B6A3E', 4210)
on conflict (id) do nothing;
