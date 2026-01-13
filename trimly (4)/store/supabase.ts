
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURATION:
 * 1. Go to your Supabase Dashboard -> Project Settings -> API
 * 2. Project URL -> Kopiraj u SUPABASE_URL
 * 3. Project API keys (anon/public) -> Kopiraj u SUPABASE_ANON_KEY
 */

// Ovo je tvoj URL (izgleda kao web adresa)
const SUPABASE_URL = 'https://nevzablirxbgipxvpecm.supabase.co';

// Ovo je tvoj ključ (onaj koji počinje s eyJ...)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldnphYmxpcnhiZ2lweHZwZWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg0MDAsImV4cCI6MjA4Mzg5NDQwMH0.LNXEtPpKBM0BX7yt0FnZDhitTpmiHA0UqeLQsZSNGwc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
