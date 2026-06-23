import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { extractBillFromText, extractBillFromPDF, extractBillFromImage, ExtractedBill } from '@/lib/claude'
import { sendWhatsApp, formatBillConfirmation, formatIncompleteConfirmation } from '@/lib/clickatell'

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = body?.data?.moMessage || body?.moMessage
    if (!message) return NextResponse.json({ status: 'ignored' })

    const from: string = message.from
    const content = message.content

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .upsert({ whatsapp_number: from }, { onConflict: 'whatsapp_number' })
      .select('id')
      .single()

    if (userError || !user) {
      console.error('User upsert failed', userError)
      return NextResponse.json({ error: 'user error' }, { status: 500 })
    }

    let extracted: ExtractedBill | null = null
    let rawContent = ''

    if (content.type === 'text') {
      rawContent = content.payload.text
      extracted = await extractBillFromText(rawContent)
    } else if (content.type === 'file' || content.type === 'document') {
      rawContent = `[file: ${content.payload.url}]`
      const fileRes = await fetch(content.payload.url)
      const buffer = await fileRes.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mime = content.payload.mimeType || 'application/pdf'
      extracted = mime === 'application/pdf'
        ? await extractBillFromPDF(base64)
        : await extractBillFromImage(base64, mime)
    } else if (content.type === 'image') {
      rawContent = `[image: ${content.payload.url}]`
      const fileRes = await fetch(content.payload.url)
      const buffer = await fileRes.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      extracted = await extractBillFromImage(base64, content.payload.mimeType || 'image/jpeg')
    }

    if (!extracted?.payee || !extracted?.amount) {
      await sendWhatsApp(from, "Sorry, I couldn't read that. Try forwarding the PDF or type: who to pay, how much, their bank details and due date.")
      return NextResponse.json({ status: 'ok' })
    }

    // Payee memory — save details if we have them, look them up if we don't
    if (extracted.account_number) {
      await upsertPayee(user.id, extracted)
    } else {
      const savedPayee = await lookupPayee(user.id, extracted.payee)
      if (savedPayee) {
        extracted.bank_name = savedPayee.bank_name
        extracted.account_number = savedPayee.account_number
        extracted.branch_code = savedPayee.branch_code
        extracted.reference = extracted.reference ?? savedPayee.default_reference
      }
    }

    await supabaseAdmin.from('bills').insert({
      user_id: user.id,
      payee: extracted.payee,
      amount: extracted.amount,
      due_date: extracted.due_date,
      bank_name: extracted.bank_name,
      account_number: extracted.account_number,
      branch_code: extracted.branch_code,
      reference: extracted.reference,
      raw_message: rawContent,
      status: 'pending',
    })

    const isComplete = !!extracted.account_number
    const reply = isComplete
      ? formatBillConfirmation(extracted.payee, extracted.amount, extracted.due_date)
      : formatIncompleteConfirmation(extracted.payee, extracted.amount, extracted.due_date)

    await sendWhatsApp(from, reply)
    return NextResponse.json({ status: 'ok' })

  } catch (err) {
    console.error('Webhook error', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

async function upsertPayee(userId: string, bill: ExtractedBill) {
  if (!bill.payee || !bill.account_number) return
  const name = bill.payee.toLowerCase().trim()
  await supabaseAdmin.from('payees').upsert({
    user_id: userId,
    name,
    display_name: bill.payee,
    bank_name: bill.bank_name,
    account_number: bill.account_number,
    branch_code: bill.branch_code,
    default_reference: bill.reference,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,name' })
}

async function lookupPayee(userId: string, payeeName: string) {
  const { data: payees } = await supabaseAdmin
    .from('payees')
    .select('*')
    .eq('user_id', userId)

  if (!payees?.length) return null

  const needle = payeeName.toLowerCase().trim()
  return payees.find(p =>
    p.name.includes(needle) || needle.includes(p.name)
  ) ?? null
}
