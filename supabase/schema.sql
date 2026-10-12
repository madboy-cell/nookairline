-- ====================================================================
-- SKY PARTY / NOOK AIRLINE — SUPABASE POSTGRESQL SCHEMA (PHASE 5)
-- Supports: Supabase Auth, Profiles, Global Character Base,
-- Couple Sanctuary, Friends System, and Decouple Safety.
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    character_base TEXT NOT NULL DEFAULT 'bkk' CHECK (character_base IN ('bkk', 'dxb')),
    equipped_costume TEXT NOT NULL DEFAULT 'pilot',
    diamonds BIGINT NOT NULL DEFAULT 15000 CHECK (diamonds >= 0),
    stardust BIGINT NOT NULL DEFAULT 0 CHECK (stardust >= 0),
    inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
    pity JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast username lookups (friends & couple search)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 2. COUPLES TABLE (Couple Sanctuary)
-- Critical rule: Decoupling (deleting a couple row) NEVER deletes or alters profiles, diamonds, or wardrobe.
CREATE TABLE IF NOT EXISTS public.couples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked')),
    anniversary_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT couple_users_distinct CHECK (user1_id <> user2_id),
    CONSTRAINT couple_unique_pair UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_couples_users ON public.couples(user1_id, user2_id);

-- 3. FRIENDSHIPS TABLE
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT friendship_users_distinct CHECK (user_id <> friend_id),
    CONSTRAINT friendship_unique_pair UNIQUE (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_friend ON public.friendships(user_id, friend_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are readable by authenticated users"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Couples Policies
CREATE POLICY "Couples are viewable by participants"
    ON public.couples FOR SELECT
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create couple invites"
    ON public.couples FOR INSERT
    WITH CHECK (auth.uid() = user1_id);

CREATE POLICY "Participants can update couple state"
    ON public.couples FOR UPDATE
    USING (auth.uid() = user1_id OR auth.uid() = user2_id)
    WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Participants can dissolve couple connection"
    ON public.couples FOR DELETE
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Friendships Policies
CREATE POLICY "Friendships are viewable by participants"
    ON public.friendships FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can initiate friend requests"
    ON public.friendships FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Participants can update friendship status"
    ON public.friendships FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = friend_id)
    WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Participants can delete friendships"
    ON public.friendships FOR DELETE
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 5. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, character_base, diamonds, stardust)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'username',
            'Captain_' || substring(NEW.id::text from 1 for 6)
        ),
        COALESCE(NEW.raw_user_meta_data->>'character_base', 'bkk'),
        15000,
        0
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER couples_updated_at
    BEFORE UPDATE ON public.couples
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. MONOPOLY ROOMS & MATCHMAKING TABLE
CREATE TABLE IF NOT EXISTS public.monopoly_rooms (
    id TEXT PRIMARY KEY,
    code VARCHAR(6) NOT NULL UNIQUE,
    flight_number VARCHAR(20) NOT NULL,
    name TEXT NOT NULL,
    host_uid TEXT NOT NULL,
    host_name TEXT NOT NULL,
    host_avatar TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_flight', 'finished')),
    description TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    game VARCHAR(50) NOT NULL DEFAULT 'monopoly',
    auto_fill BOOLEAN NOT NULL DEFAULT false,
    slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    game_state JSONB,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_monopoly_rooms_code ON public.monopoly_rooms(code);
CREATE INDEX IF NOT EXISTS idx_monopoly_rooms_status ON public.monopoly_rooms(status);
CREATE INDEX IF NOT EXISTS idx_monopoly_rooms_public ON public.monopoly_rooms(is_public, status);

CREATE OR REPLACE TRIGGER monopoly_rooms_updated_at
    BEFORE UPDATE ON public.monopoly_rooms
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. MONOPOLY ROOM MEMBERS TABLE (Tracks player slots, disconnect grace, and reconnection)
CREATE TABLE IF NOT EXISTS public.monopoly_room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id TEXT NOT NULL REFERENCES public.monopoly_rooms(id) ON DELETE CASCADE,
    user_uid TEXT NOT NULL,
    slot_id INT NOT NULL CHECK (slot_id BETWEEN 1 AND 4),
    role TEXT,
    name TEXT NOT NULL,
    avatar TEXT,
    ready BOOLEAN NOT NULL DEFAULT false,
    spectator BOOLEAN NOT NULL DEFAULT false,
    connected BOOLEAN NOT NULL DEFAULT true,
    disconnected_at TIMESTAMPTZ,
    last_active TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_room_slot UNIQUE (room_id, slot_id),
    CONSTRAINT unique_room_member UNIQUE (room_id, user_uid)
);

CREATE INDEX IF NOT EXISTS idx_monopoly_members_uid ON public.monopoly_room_members(user_uid);
CREATE INDEX IF NOT EXISTS idx_monopoly_members_room ON public.monopoly_room_members(room_id);

ALTER TABLE public.monopoly_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monopoly_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read monopoly_rooms" ON public.monopoly_rooms FOR SELECT USING (true);
CREATE POLICY "Allow public insert monopoly_rooms" ON public.monopoly_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update monopoly_rooms" ON public.monopoly_rooms FOR UPDATE USING (true);
CREATE POLICY "Allow public delete monopoly_rooms" ON public.monopoly_rooms FOR DELETE USING (true);

CREATE POLICY "Allow public read monopoly_room_members" ON public.monopoly_room_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert monopoly_room_members" ON public.monopoly_room_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update monopoly_room_members" ON public.monopoly_room_members FOR UPDATE USING (true);
CREATE POLICY "Allow public delete monopoly_room_members" ON public.monopoly_room_members FOR DELETE USING (true);

