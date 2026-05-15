import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This is the standard client for the browser
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// This is the admin client for Server Actions
// We only initialize it if the key exists to avoid the "required" error on the client side
export const supabaseAdmin: SupabaseClient | null =
    typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
        : null;