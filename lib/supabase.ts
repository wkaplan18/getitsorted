import { createClient } from '@supabase/supabase-js'

// Public client — safe for browser use
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Service role client — server-side only, bypasses RLS
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type Bill = {
  id: string
  user_id: string
  payee: string
  amount: number
  due_date: string | null
  bank_name: string | null
  account_number: string | null
  branch_code: string | null
  reference: string | null
  status: 'pending' | 'paid' | 'overdue'
  stitch_payment_id: string | null
  raw_message: string | null
  reminder_sent: boolean
  unconfirmed: boolean
  sent_by: string | null          // whatsapp number of the trusted sender who forwarded it, null if the account owner sent it
  whatsapp_message_id: string | null
  created_at: string
  paid_at: string | null
}

export type Reminder = {
  id: string
  user_id: string
  sent_by: string | null
  sender_label: string | null
  message: string
  remind_at: string | null        // when to send a WhatsApp nudge, null = no timed nudge
  nudge_sent: boolean
  whatsapp_message_id: string | null
  dismissed: boolean
  created_at: string
}

export type Payee = {
  id: string
  user_id: string
  name: string           // normalised lowercase
  display_name: string
  bank_name: string | null
  account_number: string | null
  branch_code: string | null
  default_reference: string | null
  updated_at: string
}

export type User = {
  id: string
  whatsapp_number: string
  name: string | null
  created_at: string
}
