
-- 1. TABLICA PROFILA
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'customer',
  banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLICA BARBERA
CREATE TABLE IF NOT EXISTS public.barbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  profile_picture TEXT,
  phone_number TEXT,
  neighborhood TEXT,
  address TEXT,
  zip_code TEXT,
  city TEXT DEFAULT 'Zagreb',
  bio TEXT,
  gallery TEXT[] DEFAULT '{}',
  work_mode TEXT DEFAULT 'classic',
  approved BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  weekly_winner BOOLEAN DEFAULT false,
  working_hours JSONB DEFAULT '[]',
  slot_interval INTEGER DEFAULT 45,
  last_updated_week INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. POMOĆNE TABLICE
CREATE TABLE IF NOT EXISTS public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  duration TEXT,
  description TEXT,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT,
  date TEXT,
  time TEXT,
  price NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  rating INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SIGURNOST (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Funkcija za provjeru Admina
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Polise za PROFILES
DROP POLICY IF EXISTS "Svi mogu vidjeti profile" ON public.profiles;
DROP POLICY IF EXISTS "Korisnici mogu mijenjati svoj profil" ON public.profiles;
DROP POLICY IF EXISTS "Admini mogu mijenjati sve profile" ON public.profiles;
CREATE POLICY "Svi mogu vidjeti profile" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Korisnici mogu mijenjati svoj profil" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admini mogu mijenjati sve profile" ON public.profiles FOR ALL USING (public.is_admin());

-- Polise za BARBERS
DROP POLICY IF EXISTS "Svi mogu vidjeti odobrene barbere" ON public.barbers;
DROP POLICY IF EXISTS "Barberi mogu kreirati svoj profil" ON public.barbers;
DROP POLICY IF EXISTS "Barberi mogu mijenjati svoj profil" ON public.barbers;
DROP POLICY IF EXISTS "Admini mogu brisati barbere" ON public.barbers;
CREATE POLICY "Svi mogu vidjeti odobrene barbere" ON public.barbers FOR SELECT USING (approved = true OR auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Barberi mogu kreirati svoj profil" ON public.barbers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Barberi mogu mijenjati svoj profil" ON public.barbers FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admini mogu brisati barbere" ON public.barbers FOR DELETE USING (public.is_admin());

-- 5. AUTOMATIZACIJA (Trigger za nove korisnike)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
