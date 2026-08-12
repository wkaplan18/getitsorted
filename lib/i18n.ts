// Sorted — WhatsApp reply strings in the three languages the product supports.
//
// Input is NOT translated: Claude parses isiZulu, isiXhosa, Afrikaans, Sesotho
// and code-switched English natively (see lib/claude.ts). This file only covers
// what Sorted says back, because a reply the user can't read is a support
// ticket they have no way to raise.
//
// Rule: money, numbers, dates, names and document numbers are NEVER translated.
// "R3,750" and "Mrs Naidoo" render identically in all three languages — only the
// sentence around them changes. Keeps the numbers unambiguous and the
// translation surface small.
//
// NOTE FOR REVIEW: the isiZulu and Afrikaans strings below need a native-speaker
// pass before this goes to real users. The structure is right; the phrasing
// should be checked by someone who speaks it daily.

export const LANGUAGES = ['en', 'zu', 'af'] as const
export type Lang = (typeof LANGUAGES)[number]

export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  zu: 'isiZulu',
  af: 'Afrikaans',
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

// Falls back to English rather than throwing — a missing translation should
// degrade to a language the user probably half-reads, never to a crash.
export function toLang(value: unknown): Lang {
  return isLang(value) ? value : 'en'
}

type Strings = Record<StringKey, string>

export type StringKey =
  // language selection
  | 'pick_language'
  | 'language_set'
  // onboarding
  | 'welcome'
  | 'ask_business_name'
  | 'ask_trade'
  | 'ask_name'
  | 'ask_logo'
  | 'logo_saved'
  | 'onboarding_done'
  | 'onboarding_offer'
  // quoting
  | 'quote_header'
  | 'quote_for'
  | 'quote_total'
  | 'quote_confirm'
  | 'quote_updated'
  | 'quote_sent'
  | 'quote_forward'
  | 'quote_cancelled'
  | 'quote_no_items'
  | 'quote_needs_profile'
  // notifications
  | 'quote_viewed'
  | 'quote_paid'
  | 'invoice_created'
  | 'invoice_photos'
  | 'month_summary_header'
  | 'month_money_in'
  | 'month_outstanding'
  | 'month_bills_paid'
  | 'month_chase'
  // disambiguation
  | 'ask_bill_or_quote'
  // listing
  | 'quotes_none'
  | 'quotes_header'
  // generic
  | 'help'
  | 'not_understood'
  | 'save_failed'
  | 'cancelled'

const en: Strings = {
  pick_language:
    "Hi! I'm Sorted. I help you send quotes and get paid, and I keep track of the bills you owe.\n\nFirst — which language should I reply in?\n1  English\n2  isiZulu\n3  Afrikaans",
  language_set: "Done, I'll reply in English from now on.",

  welcome: "Hi! I'm Sorted. Send me a bill to track, or tell me about a job to make a quote.",
  ask_business_name: "What's your business called?",
  ask_trade: 'Got it, {business}. What work do you do?',
  ask_name: 'And your name?',
  ask_logo:
    "Last thing — send me your logo as a picture if you have one.\nNo logo? Just reply SKIP and I'll use your business name.",
  logo_saved: 'Logo saved.',
  onboarding_done:
    "Done. You're set up.\n\nTo make a quote, just tell me who it's for and what you're charging.\nLike this:\n\"Quote for Mrs Naidoo, paint 3 bedrooms R850 each, materials R1200\"\n\nTry it now.",
  onboarding_offer:
    "Looks like you want to send a quote. I just need a few details first — it takes a minute.",

  quote_header: "Here's the quote:",
  quote_for: 'FOR: {customer}',
  quote_total: 'TOTAL',
  quote_confirm: 'Reply SEND to make the PDF, or tell me what to change.',
  quote_updated: 'Updated:',
  quote_sent: '{number} ready 👇\n{link}',
  quote_forward:
    "Forward that to {customer}. They can view it and pay you right there.\n\nI'll tell you the moment they open it or pay.",
  quote_cancelled: 'Quote cancelled, nothing sent.',
  quote_no_items: "I couldn't find any prices in that. Tell me what you're charging, like \"paint 3 rooms R850 each\".",
  quote_needs_profile: "I need your business name first before I can make a quote.",

  quote_viewed: '👀 {customer} opened {number}.',
  quote_paid: "💰 {customer} paid {amount} for {number}.\nMoney's on its way to your account.",
  invoice_created: 'Nice one. Turned it into invoice {number}.',
  invoice_photos: 'Want to add photos of the finished work? Just send them.',
  month_summary_header: '{month} for {business}:',
  month_money_in: 'Money in',
  month_outstanding: 'Still owed',
  month_bills_paid: 'Bills paid',
  month_chase: "Want me to chase the {count} who haven't paid? Reply YES.",

  ask_bill_or_quote:
    'Quick check — is this a bill you need to PAY, or a quote you\'re SENDING to a customer?\n\n1  I need to pay it\n2  I\'m sending it to a customer',

  quotes_none: "You haven't made any quotes yet.",
  quotes_header: 'Your last quotes:',

  help:
    'Here\'s what I can do:\n\n• Send me a job → I make a quote\n• Send me a bill → I track it and remind you\n• QUOTES — your recent quotes\n• BILLS — what you owe\n• LOGIN — get your dashboard code\n• LANGUAGE — change language\n• STOP — pause messages',
  not_understood: "I didn't quite get that. Reply HELP to see what I can do.",
  save_failed: "Something went wrong saving that. Please send it again.",
  cancelled: 'Cancelled.',
}

const zu: Strings = {
  pick_language:
    'Sawubona! NginguSorted. Ngikusiza uthumele ama-quote uthole nemali, futhi ngigcine amabhili okumele uwakhokhe.\n\nOkokuqala — ngikhulume nawe ngaluphi ulimi?\n1  IsiNgisi\n2  IsiZulu\n3  IsiBhunu',
  language_set: 'Kulungile, ngizophendula ngesiZulu kusukela manje.',

  welcome: 'Sawubona! NginguSorted. Ngithumele ibhili ukuze ngiligcine, noma ungitshele ngomsebenzi ukuze ngenze i-quote.',
  ask_business_name: 'Libizwa ngokuthi yini ibhizinisi lakho?',
  ask_trade: 'Ngiyabonga, {business}. Wenza msebenzi muni?',
  ask_name: 'Ngubani igama lakho?',
  ask_logo:
    'Okokugcina — ngithumele ilogo yakho njengesithombe uma unayo.\nAwunayo ilogo? Phendula ngo-SKIP ngisebenzise igama lebhizinisi lakho.',
  logo_saved: 'Ilogo igciniwe.',
  onboarding_done:
    'Kulungile. Usulungile.\n\nUkwenza i-quote, ngitshele nje ukuthi ngeyabani nokuthi ubiza malini.\nNjengalokhu:\n"Quote ka-Mrs Naidoo, penda amakamelo ama-3 R850 ngalinye, izinto R1200"\n\nZama manje.',
  onboarding_offer:
    'Kubukeka sengathi ufuna ukuthumela i-quote. Ngidinga imininingwane embalwa kuqala — kuthatha umzuzu.',

  quote_header: 'Nayi i-quote:',
  quote_for: 'EYA: {customer}',
  quote_total: 'ISAMBA',
  quote_confirm: 'Phendula ngo-SEND ukuze ngenze i-PDF, noma ungitshele ukuthi ngishintshe ini.',
  quote_updated: 'Kubuyekeziwe:',
  quote_sent: 'I-{number} isilungile 👇\n{link}',
  quote_forward:
    'Dlulisela lokho ku-{customer}. Bangayibona bakukhokhele khona lapho.\n\nNgizokutshela ngokushesha uma beyivula noma bekhokha.',
  quote_cancelled: 'I-quote ikhanseliwe, akuthunyelwanga lutho.',
  quote_no_items: 'Angitholanga zintengo lapho. Ngitshele ukuthi ubiza malini, njenge "penda amakamelo ama-3 R850 ngalinye".',
  quote_needs_profile: 'Ngidinga igama lebhizinisi lakho kuqala ngaphambi kokwenza i-quote.',

  quote_viewed: '👀 U-{customer} uyivulile i-{number}.',
  quote_paid: '💰 U-{customer} ukhokhe u-{amount} we-{number}.\nImali isendleleni eya ku-akhawunti yakho.',
  invoice_created: 'Kuhle. Ngiyiguqule yaba yi-invoice {number}.',
  invoice_photos: 'Ufuna ukufaka izithombe zomsebenzi oqediwe? Zithumele nje.',
  month_summary_header: 'U-{month} ka-{business}:',
  month_money_in: 'Imali engenile',
  month_outstanding: 'Esakweletwa',
  month_bills_paid: 'Amabhili akhokhiwe',
  month_chase: 'Ufuna ngibalandelele laba abangu-{count} abangakhokhi? Phendula ngo-YES.',

  ask_bill_or_quote:
    'Ake ngiqinisekise — leli yibhili okumele ULIKHOKHE, noma yi-quote OYITHUMELA ikhasimende?\n\n1  Kumele ngiyikhokhe\n2  Ngiyithumela ikhasimende',

  quotes_none: 'Awukakenzi ama-quote okwamanje.',
  quotes_header: 'Ama-quote akho akamuva:',

  help:
    'Nakhu engingakwenza:\n\n• Ngithumele umsebenzi → ngenza i-quote\n• Ngithumele ibhili → ngiyaligcina ngikukhumbuze\n• QUOTES — ama-quote akho akamuva\n• BILLS — okumele ukukhokhe\n• LOGIN — thola ikhodi ye-dashboard\n• LANGUAGE — shintsha ulimi\n• STOP — misa imiyalezo',
  not_understood: 'Angizwanga kahle. Phendula ngo-HELP ubone engingakwenza.',
  save_failed: 'Kube nenkinga ekugcineni lokho. Sicela ukuthumele futhi.',
  cancelled: 'Kukhanseliwe.',
}

const af: Strings = {
  pick_language:
    'Hallo! Ek is Sorted. Ek help jou kwotasies stuur en betaal word, en ek hou tred met die rekeninge wat jy skuld.\n\nEerstens — in watter taal moet ek antwoord?\n1  Engels\n2  isiZulu\n3  Afrikaans',
  language_set: 'Reg so, ek antwoord voortaan in Afrikaans.',

  welcome: 'Hallo! Ek is Sorted. Stuur my \'n rekening om by te hou, of vertel my van \'n werk om \'n kwotasie te maak.',
  ask_business_name: 'Wat is jou besigheid se naam?',
  ask_trade: 'Reg so, {business}. Watter werk doen jy?',
  ask_name: 'En jou naam?',
  ask_logo:
    'Laaste ding — stuur my jou logo as \'n prent as jy een het.\nGeen logo nie? Antwoord net SKIP, dan gebruik ek jou besigheidsnaam.',
  logo_saved: 'Logo gestoor.',
  onboarding_done:
    'Klaar. Jy is opgestel.\n\nOm \'n kwotasie te maak, vertel my net vir wie dit is en wat jy vra.\nSoos hierdie:\n"Kwotasie vir Mev Naidoo, verf 3 slaapkamers R850 elk, materiaal R1200"\n\nProbeer dit nou.',
  onboarding_offer:
    'Dit lyk of jy \'n kwotasie wil stuur. Ek kort net \'n paar besonderhede eers — dit vat \'n minuut.',

  quote_header: 'Hier is die kwotasie:',
  quote_for: 'VIR: {customer}',
  quote_total: 'TOTAAL',
  quote_confirm: 'Antwoord SEND om die PDF te maak, of sê my wat om te verander.',
  quote_updated: 'Opgedateer:',
  quote_sent: '{number} gereed 👇\n{link}',
  quote_forward:
    'Stuur dit aan vir {customer}. Hulle kan dit sien en jou daar en dan betaal.\n\nEk laat jou dadelik weet wanneer hulle dit oopmaak of betaal.',
  quote_cancelled: 'Kwotasie gekanselleer, niks gestuur nie.',
  quote_no_items: 'Ek kon geen pryse daarin kry nie. Sê my wat jy vra, soos "verf 3 kamers R850 elk".',
  quote_needs_profile: 'Ek kort eers jou besigheidsnaam voor ek \'n kwotasie kan maak.',

  quote_viewed: '👀 {customer} het {number} oopgemaak.',
  quote_paid: '💰 {customer} het {amount} vir {number} betaal.\nDie geld is op pad na jou rekening.',
  invoice_created: 'Mooi so. Dit is nou faktuur {number}.',
  invoice_photos: 'Wil jy foto\'s van die klaar werk byvoeg? Stuur hulle net.',
  month_summary_header: '{month} vir {business}:',
  month_money_in: 'Geld in',
  month_outstanding: 'Nog uitstaande',
  month_bills_paid: 'Rekeninge betaal',
  month_chase: 'Wil jy hê ek moet die {count} wat nie betaal het nie herinner? Antwoord YES.',

  ask_bill_or_quote:
    'Gou-gou — is dit \'n rekening wat jy moet BETAAL, of \'n kwotasie wat jy vir \'n kliënt STUUR?\n\n1  Ek moet dit betaal\n2  Ek stuur dit vir \'n kliënt',

  quotes_none: 'Jy het nog geen kwotasies gemaak nie.',
  quotes_header: 'Jou laaste kwotasies:',

  help:
    'Dis wat ek kan doen:\n\n• Stuur my \'n werk → ek maak \'n kwotasie\n• Stuur my \'n rekening → ek hou dit by en herinner jou\n• QUOTES — jou onlangse kwotasies\n• BILLS — wat jy skuld\n• LOGIN — kry jou dashboard-kode\n• LANGUAGE — verander taal\n• STOP — stop boodskappe',
  not_understood: 'Ek het dit nie heeltemal verstaan nie. Antwoord HELP om te sien wat ek kan doen.',
  save_failed: 'Iets het verkeerd geloop met stoor. Stuur dit asseblief weer.',
  cancelled: 'Gekanselleer.',
}

const STRINGS: Record<Lang, Strings> = { en, zu, af }

/**
 * Look up a reply string and substitute {placeholders}.
 *
 * Unknown languages fall back to English. Placeholders with no matching param
 * are left as-is rather than rendered as "undefined" — a visible {customer} in
 * a message is a bug report; the word "undefined" is just confusing.
 */
export function t(lang: Lang, key: StringKey, params: Record<string, string | number> = {}): string {
  const table = STRINGS[lang] ?? STRINGS.en
  const template = table[key] ?? STRINGS.en[key] ?? ''
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  )
}

/** Maps the "1 / 2 / 3" reply from the language prompt onto a Lang. */
export function langFromChoice(text: string): Lang | null {
  const cleaned = text.trim().toLowerCase()
  if (cleaned === '1' || cleaned === 'english') return 'en'
  if (cleaned === '2' || cleaned === 'zulu' || cleaned === 'isizulu') return 'zu'
  if (cleaned === '3' || cleaned === 'afrikaans' || cleaned === 'af') return 'af'
  return null
}

/** R3,750.00 — identical in every language, never localised away from ZAR. */
export function fmtRand(amount: number): string {
  return 'R' + amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
