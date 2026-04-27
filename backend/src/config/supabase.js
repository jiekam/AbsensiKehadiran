import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from backend root directory
dotenv.config({ path: join(__dirname, '..', '..', '.env') })

// Backend Admin - WAJIB pakai SERVICE_ROLE_KEY (bypass RLS)
// TIDAK ADA FALLBACK - kalau key hilang backend HARUS crash
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in environment variables')
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
