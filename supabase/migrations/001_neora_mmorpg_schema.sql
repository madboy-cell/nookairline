-- 001_neora_mmorpg_schema.sql
-- Neora World V2 / V3 MMORPG & Survival Cloud Persistence Schema for Supabase (PostgreSQL)
-- Replaces legacy V1 (nookairline) tables non-destructively by archiving V1 tables to v1_archived_*.

-- 1. Neutralize legacy V1 auth signup trigger function so it does not write V1 columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = public, auth
AS $$
BEGIN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Archive legacy V1 tables & indexes if present
ALTER INDEX IF EXISTS public.profiles_pkey RENAME TO v1_archived_profiles_pkey;
ALTER INDEX IF EXISTS public.profiles_username_key RENAME TO v1_archived_profiles_username_key;
ALTER INDEX IF EXISTS public.idx_profiles_username RENAME TO idx_v1_archived_profiles_username;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'character_base'
  ) THEN
    ALTER TABLE public.profiles RENAME TO v1_archived_profiles;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.couples RENAME TO v1_archived_couples;
ALTER TABLE IF EXISTS public.friendships RENAME TO v1_archived_friendships;
ALTER TABLE IF EXISTS public.monopoly_room_members RENAME TO v1_archived_monopoly_room_members;
ALTER TABLE IF EXISTS public.monopoly_rooms RENAME TO v1_archived_monopoly_rooms;

-- 3. Player Profiles (Authoritative JSONB + indexed combat power & activity timestamp)
CREATE TABLE IF NOT EXISTS public.profiles (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  cp integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_cp_desc ON public.profiles (cp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at_desc ON public.profiles (updated_at DESC);

-- 4. Active Auth Sessions (Persisted across Railway deploys)
CREATE TABLE IF NOT EXISTS public.sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions (user_id);

-- 5. Social Links (Friends, Couples, Streaks)
CREATE TABLE IF NOT EXISTS public.social_links (
  id text PRIMARY KEY,
  a text NOT NULL,
  b text NOT NULL,
  status text NOT NULL,
  streak integer DEFAULT 0,
  data jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_links_a ON public.social_links (a);
CREATE INDEX IF NOT EXISTS idx_social_links_b ON public.social_links (b);

-- 6. Persistent World Zones (Survival Wilds bases, shared MMORPG territory state)
CREATE TABLE IF NOT EXISTS public.world_zones (
  zone_id text PRIMARY KEY,
  kind text NOT NULL,
  state jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 7. Enable Row Level Security (RLS) & Server Sync Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow server read profiles" ON public.profiles;
CREATE POLICY "Allow server read profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow server insert profiles" ON public.profiles;
CREATE POLICY "Allow server insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow server update profiles" ON public.profiles;
CREATE POLICY "Allow server update profiles" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow server read sessions" ON public.sessions;
CREATE POLICY "Allow server read sessions" ON public.sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow server insert sessions" ON public.sessions;
CREATE POLICY "Allow server insert sessions" ON public.sessions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow server update sessions" ON public.sessions;
CREATE POLICY "Allow server update sessions" ON public.sessions FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow server delete sessions" ON public.sessions;
CREATE POLICY "Allow server delete sessions" ON public.sessions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow server read social_links" ON public.social_links;
CREATE POLICY "Allow server read social_links" ON public.social_links FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow server insert social_links" ON public.social_links;
CREATE POLICY "Allow server insert social_links" ON public.social_links FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow server update social_links" ON public.social_links;
CREATE POLICY "Allow server update social_links" ON public.social_links FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow server delete social_links" ON public.social_links;
CREATE POLICY "Allow server delete social_links" ON public.social_links FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow server read world_zones" ON public.world_zones;
CREATE POLICY "Allow server read world_zones" ON public.world_zones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow server insert world_zones" ON public.world_zones;
CREATE POLICY "Allow server insert world_zones" ON public.world_zones FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow server update world_zones" ON public.world_zones;
CREATE POLICY "Allow server update world_zones" ON public.world_zones FOR UPDATE USING (true) WITH CHECK (true);
