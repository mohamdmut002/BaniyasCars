-- Baniyas Cars — initial schema
create extension if not exists pgcrypto;

create table branches (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_ar       text not null,
  name_en       text not null,
  address_ar    text,
  address_en    text,
  phone         text,
  whatsapp      text,
  maps_url      text,
  position      int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table vehicles (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9-]+$'),
  -- Stable key of the original listing (e.g. 'auto.ae:276715', 'instagram:DerZSlriL1W').
  -- Used by imports to update instead of duplicating. Null for cars added by hand.
  source_key            text unique,
  make                  text not null,
  model                 text not null,
  trim                  text,
  generation            text,
  year                  int  not null check (year between 1950 and 2100),
  price_aed             int  check (price_aed is null or price_aed between 1 and 100000000),
  price_includes_vat    boolean,
  mileage_km            int  check (mileage_km is null or mileage_km >= 0),
  condition             text check (condition in ('new', 'used')),
  transmission          text check (transmission in ('automatic', 'cvt', 'manual', 'amt', 'dct')),
  gears                 int  check (gears is null or gears between 1 and 12),
  fuel                  text check (fuel in ('petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric')),
  engine_l              numeric(3,1) check (engine_l is null or engine_l between 0.5 and 9.9),
  horsepower            int  check (horsepower is null or horsepower between 30 and 2000),
  torque_nm             int,
  drivetrain            text check (drivetrain in ('fwd', 'rwd', 'awd', '4wd')),
  body_type             text check (body_type in ('sedan', 'suv', 'pickup', 'hatchback', 'coupe', 'van', 'other')),
  body_detail           text,
  exterior_color        text,
  interior_color        text,
  regional_spec         text check (regional_spec in ('gcc', 'american', 'japanese', 'european', 'korean', 'chinese', 'other')),
  export_only           boolean not null default false,
  warranty_ar           text,
  warranty_en           text,
  features_ar           text[] not null default '{}',
  features_en           text[] not null default '{}',
  description_ar        text,
  description_en        text,
  status                text not null default 'available' check (status in ('available', 'reserved', 'sold', 'hidden')),
  verification          text not null default 'confirmed' check (verification in ('confirmed', 'needs_confirmation', 'historical')),
  verification_note     text,
  featured              boolean not null default false,
  featured_rank         int,
  branch_id             uuid references branches(id) on delete set null,
  listed_at             timestamptz,
  last_verified_at      timestamptz,
  source_url            text,
  source_label          text,
  secondary_source_urls text[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index vehicles_public_idx on vehicles (status, verification) where status <> 'hidden';
create index vehicles_make_model_idx on vehicles (lower(make), lower(model));
create index vehicles_price_idx on vehicles (price_aed);
create index vehicles_year_idx on vehicles (year);
create index vehicles_featured_idx on vehicles (featured, featured_rank) where featured;

create table vehicle_images (
  id           uuid primary key default gen_random_uuid(),
  vehicle_id   uuid not null references vehicles(id) on delete cascade,
  url          text not null,
  -- Set when the file lives in our own storage (local disk or S3); null for remote source photos.
  storage_key  text,
  width        int,
  height       int,
  alt_ar       text,
  alt_en       text,
  position     int not null default 0,
  source       text not null default 'upload' check (source in ('upload', 'remote')),
  created_at   timestamptz not null default now()
);
create index vehicle_images_vehicle_idx on vehicle_images (vehicle_id, position);

create table offers (
  id           uuid primary key default gen_random_uuid(),
  title_ar     text not null,
  title_en     text not null,
  body_ar      text,
  body_en      text,
  vehicle_id   uuid references vehicles(id) on delete set null,
  valid_until  date,
  active       boolean not null default false,
  source_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table admin_users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique check (email = lower(email)),
  name           text not null,
  password_hash  text not null,
  role           text not null default 'staff' check (role in ('owner', 'staff')),
  active         boolean not null default true,
  failed_logins  int not null default 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now()
);

create table admin_sessions (
  token_hash   text primary key,
  user_id      uuid not null references admin_users(id) on delete cascade,
  csrf_token   text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  user_agent   text
);
create index admin_sessions_user_idx on admin_sessions (user_id);

create table inquiries (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid references vehicles(id) on delete set null,
  name        text not null,
  phone       text not null,
  message     text,
  locale      text not null default 'ar',
  status      text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index inquiries_created_idx on inquiries (created_at desc);

create table audit_log (
  id          bigserial primary key,
  user_id     uuid references admin_users(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at desc);
