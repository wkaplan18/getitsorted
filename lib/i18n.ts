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

/**
 * The very first message Sorted ever sends, and the only one that is not in a
 * language the user chose — because he hasn't chosen one yet.
 *
 * It used to be the English `pick_language` string. That was a guess dressed up
 * as a default: a man who reads isiZulu more comfortably than English was
 * greeted in English and asked, in English, whether he'd like isiZulu. The same
 * applies to the LANGUAGE command, which exists precisely for someone who
 * picked the wrong option and now cannot read his way back out.
 *
 * So all three languages, once, above a numbered list that needs no reading at
 * all. It is four lines longer than the English version and removes the only
 * step in the flow that can strand someone completely.
 */
export const PICK_LANGUAGE = [
  "Hi! I'm Sorted. I help you send professional quotes and get paid.",
  '',
  'Which language should I reply in?',
  'Ngikhulume nawe ngaluphi ulimi?',
  'In watter taal moet ek antwoord?',
  '',
  '1  English',
  '2  isiZulu',
  '3  Afrikaans',
].join('\n')

type Strings = Record<StringKey, string>

export type StringKey =
  // language selection — the question itself is PICK_LANGUAGE above (one
  // trilingual message); only the confirmation is per-language, because by then
  // we know which one to use.
  | 'language_set'
  // onboarding
  | 'welcome'
  | 'ask_business_name'
  | 'ask_trade'
  | 'ask_name'
  | 'ask_bank'
  | 'ask_account'
  | 'bank_saved'
  | 'ask_logo'
  | 'logo_saved'
  | 'logo_made'
  | 'onboarding_done'
  | 'onboarding_offer'
  // guided quote wizard
  | 'ask_client_name'
  | 'ask_client_pick'
  | 'client_known'
  | 'ask_client_address'
  | 'ask_quote_items'
  | 'ask_quote_items_short'
  | 'quote_thanks'
  // quoting
  | 'quote_header'
  | 'quote_for'
  | 'quote_total'
  | 'quote_confirm'
  | 'quote_updated'
  | 'quote_sent'
  | 'quote_forward'
  // the forwardable card — written for the CLIENT to read, not the tradesperson
  | 'doc_quotation'
  | 'doc_invoice'
  | 'doc_tax_invoice'
  | 'fwd_for'
  | 'fwd_total'
  | 'fwd_open'
  | 'quote_cancelled'
  | 'quote_no_items'
  | 'quote_no_work'
  | 'quote_needs_profile'
  // notifications
  | 'quote_viewed'
  | 'quote_paid'
  | 'invoice_created'
  | 'invoice_photos'
  | 'card_bank_rejected'
  | 'card_bank_unknown'
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
  // menu
  | 'menu'
  | 'menu_dropped'
  | 'invoice_none'
  | 'invoice_pick'
  | 'invoice_sent'
  | 'menu_invalid'
  | 'menu_logo_ask'
  | 'menu_logo_again'
  | 'profile_updated'
  | 'edit_client_none'
  | 'edit_client_pick'
  | 'edit_client_name'
  | 'edit_client_address'
  | 'edit_client_saved'
  // generic
  | 'help'
  | 'not_understood'
  | 'save_failed'
  | 'cancelled'

const en: Strings = {
  language_set: "Done, I'll reply in English from now on.",

  welcome: "Hi! I'm Sorted. Reply QUOTE whenever you need to send a client a quote.",
  ask_business_name: "What's your business called?",
  // The examples are the whole point: without them people answer this like an
  // interview question and write a sentence. A tester replied "Second hand
  // shirts". One or two words is all that goes on the quote.
  ask_trade:
    'Got it, {business}. What work do you do?\n\nJust a word or two — plumber, electrician, cleaner, painter, nail tech, garden services.',
  ask_name: 'And your name?',
  ask_bank:
    'Which bank do you use?\n\nThis goes on every quote — it is how your clients pay you, so I need it before I can make one.\n\nFNB, Standard Bank, ABSA, Nedbank, Capitec, TymeBank…',
  ask_account: 'And your account number?\n\nThis is what your clients type in when they pay you.',
  bank_saved: 'Saved — {bank}, account {account}. This appears on every quote so your clients can pay you by EFT.',
  ask_logo:
    "Last thing — send me your logo as a picture if you have one.\nNo logo? Reply SKIP and I'll make you one.",
  logo_saved: 'Logo saved.',
  logo_made: "No problem — I've made you a logo from your business name. It'll appear on every quote.",
  onboarding_done:
    "You're set up. I've saved your details, so I'll never ask again — every quote from now on uses them automatically.",
  onboarding_offer:
    "Let's get you set up first — it takes a minute, and I'll only ask once.",

  ask_client_name: "Step 1 of 3 — What is your client's name?",
  ask_client_pick:
    "Step 1 of 3 — Who is this quote for?\n\n{list}\n\nReply with a number, or type a new client's name.",
  client_known: 'Got it — {customer}. I already have their details.',
  ask_client_address: "Step 2 of 3 — What is their address?\n\nDon't have it? Reply N/A.",
  ask_quote_items:
    'Step 3 of 3 — What work are you doing, and what are you charging?\n\nFor example:\n"Paint 3 bedrooms R850 each, materials R1200"',
  // Used when the client was already on file, so step 2 never happened.
  // Counting "1 of 3" then "3 of 3" at someone makes a deliberate shortcut
  // look like a fault.
  ask_quote_items_short:
    'Last step — What work are you doing, and what are you charging?\n\nFor example:\n"Paint 3 bedrooms R850 each, materials R1200"',
  quote_thanks: 'Thanks. Putting your quote together now…',

  quote_header: "Here's the quote:",
  quote_for: 'FOR: {customer}',
  quote_total: 'TOTAL',
  quote_confirm: 'Reply SEND to make the PDF, or tell me what to change.',
  quote_updated: 'Updated:',
  quote_sent: '{number} is ready 👇',
  quote_forward:
    "Forward the message below to {customer} — it's written for them, so just press and forward.\n\nI'll tell you the moment they open it or pay.",

  doc_quotation: 'Quotation',
  doc_invoice: 'Invoice',
  doc_tax_invoice: 'Tax Invoice',
  fwd_for: 'For',
  fwd_total: 'Total',
  fwd_open: 'View it or download the PDF here:',
  quote_cancelled: 'Quote cancelled, nothing sent.',
  quote_no_items: "I couldn't find any prices in that. Tell me what you're charging, like \"paint 3 rooms R850 each\".\n\nStuck? Reply MENU to start again.",
  quote_no_work: "I've got the price — what's the work? Something like \"paint 3 bedrooms\" or \"clean 2 offices\".",
  quote_needs_profile: "I need your business name first before I can make a quote.",

  quote_viewed: '👀 {customer} opened {number}.',
  quote_paid: "💰 {customer} paid {amount} for {number}.\nMoney's on its way to your account.",
  invoice_created: 'Nice one. Turned it into invoice {number}.',
  invoice_photos: 'Want to add photos of the finished work? Just send them.',
  // Said without blame and with the way out in it: the number is usually right
  // and mistyped, and the quote still works on EFT either way.
  card_bank_rejected:
    "⚠️ {bank} didn't accept that account number, so card payments are switched off for now.\n\nYour quotes still show your bank details, so customers can still pay you by EFT.\n\nReply BANK to try the number again.",
  card_bank_unknown:
    "⚠️ I can't set up card payments with {bank} yet.\n\nYour quotes still show your bank details, so customers can pay you by EFT as normal.",
  month_summary_header: '{month} for {business}:',
  month_money_in: 'Money in',
  month_outstanding: 'Still owed',
  month_bills_paid: 'Bills paid',
  month_chase: "Want me to chase the {count} who haven't paid? Reply YES.",

  ask_bill_or_quote:
    'Quick check — is this a bill you need to PAY, or a quote you\'re SENDING to a customer?\n\n1  I need to pay it\n2  I\'m sending it to a customer',

  quotes_none: "You haven't made any quotes yet.",
  quotes_header: 'Your last quotes:',

  menu:
    'What would you like to do?\n\n1  New quote\n2  Turn a quote into an invoice\n3  My recent quotes\n4  Send a new logo\n5  My business details\n6  My banking details\n7  A client\'s details\n8  Bills I need to pay\n9  Dashboard login code\n10  Change language\n\nReply with a number.',
  menu_invalid: "That's not one of the options. Reply with a number from 1 to 10.",
  menu_dropped: "Right — I've dropped what we were doing.",
  invoice_none: "You haven't made any quotes yet — an invoice is made from one.",
  invoice_pick: 'Which quote should I invoice?\n\n{list}\n\nReply with a number.',
  invoice_sent: '{number} is ready 👇 — same figures as {source}, now as an invoice.\n\nForward the message below to {customer}.',
  menu_logo_ask:
    "Send me your new logo as a picture and I'll put it on every quote from now on.\n\nChanged your mind? Reply CANCEL.",
  menu_logo_again: "That wasn't a picture. Send the logo as an image, or reply CANCEL.",
  profile_updated: 'Updated. Your quotes will use these details from now on.',
  edit_client_none: "You don't have any saved clients yet. They get saved automatically the first time you quote them.",
  edit_client_pick: 'Which client?\n\n{list}\n\nReply with a number, or type their name.',
  edit_client_name: "{customer} — what should their name be?\n\nCorrect as is? Reply SKIP.",
  edit_client_address: "And their address?\n\nLeave it as it is? Reply SKIP.",
  edit_client_saved: 'Saved — {customer}.',

  help:
    'Here\'s what I can do:\n\n• MENU — everything, as a numbered list\n• Send me a job → I make a quote\n• Send me a bill → I track it and remind you\n• QUOTES — your recent quotes\n• BILLS — what you owe\n• BANK — change your banking details\n• LOGIN — get your dashboard code\n• LANGUAGE — change language\n• STOP — pause messages',
  not_understood: "I didn't quite get that. Reply MENU to see what I can do.",
  save_failed: "Something went wrong saving that. Please send it again.",
  cancelled: 'Cancelled. Reply MENU to see everything I can do.',
}

const zu: Strings = {
  language_set: 'Kulungile, ngizophendula ngesiZulu kusukela manje.',

  welcome: 'Sawubona! NginguSorted. Phendula ngo-QUOTE noma nini uma udinga ukuthumela ikhasimende i-quote.',
  ask_business_name: 'Libizwa ngokuthi yini ibhizinisi lakho?',
  ask_trade:
    'Ngiyabonga, {business}. Wenza msebenzi muni?\n\nIgama elilodwa noma amabili nje — iplama, u-electrician, umhlanzi, umpendi, izinzipho, izingadi.',
  ask_name: 'Ngubani igama lakho?',
  ask_bank:
    'Usebenzisa liphi ibhange?\n\nLokhu kuvela kuwo wonke ama-quote — yindlela amakhasimende akho akukhokhela ngayo, ngakho ngiyakudinga ngaphambi kokwenza i-quote.\n\nFNB, Standard Bank, ABSA, Nedbank, Capitec, TymeBank…',
  ask_account: 'Ithini inombolo ye-akhawunti yakho?\n\nYileyo amakhasimende akho ayifakayo lapho ekukhokhela.',
  bank_saved: 'Kugciniwe — {bank}, i-akhawunti {account}. Lokhu kuvela kuwo wonke ama-quote ukuze amakhasimende akhokhe nge-EFT.',
  ask_logo:
    'Okokugcina — ngithumele ilogo yakho njengesithombe uma unayo.\nAwunayo ilogo? Phendula ngo-SKIP ngikwenzele eyakho.',
  logo_saved: 'Ilogo igciniwe.',
  logo_made: 'Akunankinga — ngikwenzele ilogo ngegama lebhizinisi lakho. Izovela kuwo wonke ama-quote.',
  onboarding_done:
    'Usulungile. Ngiyigcinile imininingwane yakho, ngeke ngiphinde ngikubuze — wonke ama-quote azosebenzisa yona ngokuzenzakalela.',
  onboarding_offer:
    'Ake ngiqale ngikulungiselele — kuthatha umzuzu, futhi ngizobuza kanye kuphela.',

  ask_client_name: 'Isinyathelo 1 kwezi-3 — Ngubani igama lekhasimende lakho?',
  ask_client_pick:
    'Isinyathelo 1 kwezi-3 — Le quote ingeyabani?\n\n{list}\n\nPhendula ngenombolo, noma ubhale igama lekhasimende elisha.',
  client_known: 'Ngiyabonga — {customer}. Sengivele nginayo imininingwane yabo.',
  ask_client_address: 'Isinyathelo 2 kwezi-3 — Ithini ikheli labo?\n\nAwunalo? Phendula ngo-N/A.',
  ask_quote_items:
    'Isinyathelo 3 kwezi-3 — Uwenza muphi umsebenzi, futhi ubiza malini?\n\nIsibonelo:\n"Penda amakamelo ama-3 R850 ngalinye, izinto R1200"',
  ask_quote_items_short:
    'Isinyathelo sokugcina — Uwenza muphi umsebenzi, futhi ubiza malini?\n\nIsibonelo:\n"Penda amakamelo ama-3 R850 ngalinye, izinto R1200"',
  quote_thanks: 'Ngiyabonga. Ngiyalungisa i-quote yakho manje…',

  quote_header: 'Nayi i-quote:',
  quote_for: 'EYA: {customer}',
  quote_total: 'ISAMBA',
  quote_confirm: 'Phendula ngo-SEND ukuze ngenze i-PDF, noma ungitshele ukuthi ngishintshe ini.',
  quote_updated: 'Kubuyekeziwe:',
  quote_sent: 'I-{number} isilungile 👇',
  quote_forward:
    'Dlulisela umlayezo ongezansi ku-{customer} — ubhalelwe bona, ngakho cindezela nje udlulisele.\n\nNgizokutshela ngokushesha uma beyivula noma bekhokha.',

  doc_quotation: 'I-Quote',
  doc_invoice: 'I-Invoice',
  doc_tax_invoice: 'I-Tax Invoice',
  fwd_for: 'Eyaka',
  fwd_total: 'Isamba',
  fwd_open: 'Yibuke noma ulande i-PDF lapha:',
  quote_cancelled: 'I-quote ikhanseliwe, akuthunyelwanga lutho.',
  quote_no_items: 'Angitholanga zintengo lapho. Ngitshele ukuthi ubiza malini, njenge "penda amakamelo ama-3 R850 ngalinye".\n\nUbambekile? Phendula ngo-MENU uqale kabusha.',
  quote_no_work: 'Nginayo intengo — kodwa umsebenzi uyini? Okuthile njenge "penda amakamelo ama-3" noma "hlanza amahhovisi ama-2".',
  quote_needs_profile: 'Ngidinga igama lebhizinisi lakho kuqala ngaphambi kokwenza i-quote.',

  quote_viewed: '👀 U-{customer} uyivulile i-{number}.',
  quote_paid: '💰 U-{customer} ukhokhe u-{amount} we-{number}.\nImali isendleleni eya ku-akhawunti yakho.',
  invoice_created: 'Kuhle. Ngiyiguqule yaba yi-invoice {number}.',
  invoice_photos: 'Ufuna ukufaka izithombe zomsebenzi oqediwe? Zithumele nje.',
  card_bank_rejected:
    "⚠️ I-{bank} ayilamukelanga lelo nombolo le-akhawunti, ngakho izinkokhelo ngekhadi zivaliwe okwamanje.\n\nAmakhotheshini akho asabonisa imininingwane yasebhange, ngakho amakhasimende asengakhokha nge-EFT.\n\nPhendula ngo-BANK ukuzama futhi.",
  card_bank_unknown:
    "⚠️ Angikwazi ukusetha izinkokhelo ngekhadi nge-{bank} okwamanje.\n\nAmakhotheshini akho asabonisa imininingwane yasebhange, ngakho amakhasimende angakhokha nge-EFT njengenjwayelo.",
  month_summary_header: 'U-{month} ka-{business}:',
  month_money_in: 'Imali engenile',
  month_outstanding: 'Esakweletwa',
  month_bills_paid: 'Amabhili akhokhiwe',
  month_chase: 'Ufuna ngibalandelele laba abangu-{count} abangakhokhi? Phendula ngo-YES.',

  ask_bill_or_quote:
    'Ake ngiqinisekise — leli yibhili okumele ULIKHOKHE, noma yi-quote OYITHUMELA ikhasimende?\n\n1  Kumele ngiyikhokhe\n2  Ngiyithumela ikhasimende',

  quotes_none: 'Awukakenzi ama-quote okwamanje.',
  quotes_header: 'Ama-quote akho akamuva:',

  menu:
    'Ufuna ukwenzani?\n\n1  I-quote entsha\n2  Guqula i-quote ibe yi-invoice\n3  Ama-quote ami akamuva\n4  Thumela ilogo entsha\n5  Imininingwane yebhizinisi lami\n6  Imininingwane yebhange lami\n7  Imininingwane yekhasimende\n8  Amabhili okumele ngiwakhokhe\n9  Ikhodi yokungena ku-dashboard\n10  Shintsha ulimi\n\nPhendula ngenombolo.',
  menu_invalid: 'Leyo ayikho kulezi zinketho. Phendula ngenombolo kusukela ku-1 kuya ku-10.',
  menu_dropped: 'Kulungile — ngikuyekile ebesikwenza.',
  invoice_none: 'Awukakenzi ama-quote — i-invoice yenziwa nge-quote.',
  invoice_pick: 'Iyiphi i-quote ofuna ngiyenze i-invoice?\n\n{list}\n\nPhendula ngenombolo.',
  invoice_sent: 'I-{number} isilungile 👇 — amanani afanayo ne-{source}, manje kuyi-invoice.\n\nDlulisela umlayezo ongezansi ku-{customer}.',
  menu_logo_ask:
    'Ngithumele ilogo yakho entsha njengesithombe, ngizoyifaka kuwo wonke ama-quote kusukela manje.\n\nUshintshe umqondo? Phendula ngo-CANCEL.',
  menu_logo_again: 'Leso bekungesona isithombe. Thumela ilogo njengesithombe, noma uphendule ngo-CANCEL.',
  profile_updated: 'Kubuyekeziwe. Ama-quote akho azosebenzisa le mininingwane kusukela manje.',
  edit_client_none: 'Awunawo amakhasimende agciniwe okwamanje. Agcinwa ngokuzenzakalela uma uwathumelela i-quote okokuqala.',
  edit_client_pick: 'Iliphi ikhasimende?\n\n{list}\n\nPhendula ngenombolo, noma ubhale igama labo.',
  edit_client_name: 'U-{customer} — kufanele libe ngubani igama labo?\n\nLilungile njengoba linjalo? Phendula ngo-SKIP.',
  edit_client_address: 'Lithini ikheli labo?\n\nUfuna ukulishiya njengoba linjalo? Phendula ngo-SKIP.',
  edit_client_saved: 'Kugciniwe — {customer}.',

  help:
    'Nakhu engingakwenza:\n\n• MENU — konke, ohlwini olunezinombolo\n• Ngithumele umsebenzi → ngenza i-quote\n• Ngithumele ibhili → ngiyaligcina ngikukhumbuze\n• QUOTES — ama-quote akho akamuva\n• BILLS — okumele ukukhokhe\n• BANK — shintsha imininingwane yasebhange\n• LOGIN — thola ikhodi ye-dashboard\n• LANGUAGE — shintsha ulimi\n• STOP — misa imiyalezo',
  not_understood: 'Angizwanga kahle. Phendula ngo-MENU ubone engingakwenza.',
  save_failed: 'Kube nenkinga ekugcineni lokho. Sicela ukuthumele futhi.',
  cancelled: 'Kukhanseliwe. Phendula ngo-MENU ubone konke engingakwenza.',
}

const af: Strings = {
  language_set: 'Reg so, ek antwoord voortaan in Afrikaans.',

  welcome: 'Hallo! Ek is Sorted. Antwoord KWOTASIE wanneer jy vir \'n kliënt \'n kwotasie moet stuur.',
  ask_business_name: 'Wat is jou besigheid se naam?',
  ask_trade:
    "Reg so, {business}. Watter werk doen jy?\n\nNet 'n woord of twee — loodgieter, elektrisiën, skoonmaker, verwer, naels, tuindienste.",
  ask_name: 'En jou naam?',
  ask_bank:
    'Watter bank gebruik jy?\n\nDit verskyn op elke kwotasie — dis hoe jou kliënte jou betaal, so ek het dit nodig voordat ek een kan maak.\n\nFNB, Standard Bank, ABSA, Nedbank, Capitec, TymeBank…',
  ask_account: 'En jou rekeningnommer?\n\nDis wat jou kliënte intik wanneer hulle jou betaal.',
  bank_saved: 'Gestoor — {bank}, rekening {account}. Dit verskyn op elke kwotasie sodat jou kliënte jou per EFT kan betaal.',
  ask_logo:
    'Laaste ding — stuur my jou logo as \'n prent as jy een het.\nGeen logo nie? Antwoord SKIP, dan maak ek vir jou een.',
  logo_saved: 'Logo gestoor.',
  logo_made: 'Geen probleem nie — ek het vir jou \'n logo uit jou besigheidsnaam gemaak. Dit verskyn op elke kwotasie.',
  onboarding_done:
    'Jy is opgestel. Ek het jou besonderhede gestoor, so ek vra nooit weer nie — elke kwotasie gebruik hulle outomaties.',
  onboarding_offer:
    'Kom ons stel jou eers op — dit vat \'n minuut, en ek vra net een keer.',

  ask_client_name: 'Stap 1 van 3 — Wat is jou kliënt se naam?',
  ask_client_pick:
    "Stap 1 van 3 — Vir wie is hierdie kwotasie?\n\n{list}\n\nAntwoord met 'n nommer, of tik 'n nuwe kliënt se naam.",
  client_known: 'Reg so — {customer}. Ek het reeds hulle besonderhede.',
  ask_client_address: 'Stap 2 van 3 — Wat is hulle adres?\n\nHet jy dit nie? Antwoord N/A.',
  ask_quote_items:
    'Stap 3 van 3 — Watter werk doen jy, en wat vra jy?\n\nByvoorbeeld:\n"Verf 3 slaapkamers R850 elk, materiaal R1200"',
  ask_quote_items_short:
    'Laaste stap — Watter werk doen jy, en wat vra jy?\n\nByvoorbeeld:\n"Verf 3 slaapkamers R850 elk, materiaal R1200"',
  quote_thanks: 'Dankie. Ek stel nou jou kwotasie saam…',

  quote_header: 'Hier is die kwotasie:',
  quote_for: 'VIR: {customer}',
  quote_total: 'TOTAAL',
  quote_confirm: 'Antwoord SEND om die PDF te maak, of sê my wat om te verander.',
  quote_updated: 'Opgedateer:',
  quote_sent: '{number} is gereed 👇',
  quote_forward:
    'Stuur die boodskap hieronder aan vir {customer} — dit is vir hulle geskryf, druk en stuur dit net aan.\n\nEk laat jou dadelik weet wanneer hulle dit oopmaak of betaal.',

  doc_quotation: 'Kwotasie',
  doc_invoice: 'Faktuur',
  doc_tax_invoice: 'BTW-faktuur',
  fwd_for: 'Vir',
  fwd_total: 'Totaal',
  fwd_open: 'Sien dit of laai die PDF hier af:',
  quote_cancelled: 'Kwotasie gekanselleer, niks gestuur nie.',
  quote_no_items: 'Ek kon geen pryse daarin kry nie. Sê my wat jy vra, soos "verf 3 kamers R850 elk".\n\nVasgevang? Antwoord MENU om weer te begin.',
  quote_no_work: 'Ek het die prys — maar wat is die werk? Iets soos "verf 3 slaapkamers" of "maak 2 kantore skoon".',
  quote_needs_profile: 'Ek kort eers jou besigheidsnaam voor ek \'n kwotasie kan maak.',

  quote_viewed: '👀 {customer} het {number} oopgemaak.',
  quote_paid: '💰 {customer} het {amount} vir {number} betaal.\nDie geld is op pad na jou rekening.',
  invoice_created: 'Mooi so. Dit is nou faktuur {number}.',
  invoice_photos: 'Wil jy foto\'s van die klaar werk byvoeg? Stuur hulle net.',
  card_bank_rejected:
    "⚠️ {bank} het daardie rekeningnommer nie aanvaar nie, so kaartbetalings is vir eers af.\n\nJou kwotasies wys steeds jou bankbesonderhede, so kliënte kan jou steeds per EFT betaal.\n\nAntwoord BANK om die nommer weer te probeer.",
  card_bank_unknown:
    "⚠️ Ek kan nog nie kaartbetalings met {bank} opstel nie.\n\nJou kwotasies wys steeds jou bankbesonderhede, so kliënte kan jou soos gewoonlik per EFT betaal.",
  month_summary_header: '{month} vir {business}:',
  month_money_in: 'Geld in',
  month_outstanding: 'Nog uitstaande',
  month_bills_paid: 'Rekeninge betaal',
  month_chase: 'Wil jy hê ek moet die {count} wat nie betaal het nie herinner? Antwoord YES.',

  ask_bill_or_quote:
    'Gou-gou — is dit \'n rekening wat jy moet BETAAL, of \'n kwotasie wat jy vir \'n kliënt STUUR?\n\n1  Ek moet dit betaal\n2  Ek stuur dit vir \'n kliënt',

  quotes_none: 'Jy het nog geen kwotasies gemaak nie.',
  quotes_header: 'Jou laaste kwotasies:',

  menu:
    'Wat wil jy doen?\n\n1  Nuwe kwotasie\n2  Maak \'n faktuur van \'n kwotasie\n3  My onlangse kwotasies\n4  Stuur \'n nuwe logo\n5  My besigheidsbesonderhede\n6  My bankbesonderhede\n7  \'n Kliënt se besonderhede\n8  Rekeninge wat ek moet betaal\n9  Dashboard-inteikenkode\n10  Verander taal\n\nAntwoord met \'n nommer.',
  menu_invalid: 'Dit is nie een van die opsies nie. Antwoord met \'n nommer van 1 tot 10.',
  menu_dropped: 'Reg — ek het laat vaar waarmee ons besig was.',
  invoice_none: 'Jy het nog geen kwotasies nie — \'n faktuur word van een gemaak.',
  invoice_pick: 'Watter kwotasie moet ek faktureer?\n\n{list}\n\nAntwoord met \'n nommer.',
  invoice_sent: '{number} is gereed 👇 — dieselfde bedrae as {source}, nou as \'n faktuur.\n\nStuur die boodskap hieronder aan vir {customer}.',
  menu_logo_ask:
    'Stuur my jou nuwe logo as \'n prent, dan sit ek dit voortaan op elke kwotasie.\n\nVan plan verander? Antwoord CANCEL.',
  menu_logo_again: 'Dit was nie \'n prent nie. Stuur die logo as \'n prent, of antwoord CANCEL.',
  profile_updated: 'Opgedateer. Jou kwotasies gebruik voortaan hierdie besonderhede.',
  edit_client_none: 'Jy het nog geen gestoorde kliënte nie. Hulle word outomaties gestoor die eerste keer wat jy vir hulle kwoteer.',
  edit_client_pick: 'Watter kliënt?\n\n{list}\n\nAntwoord met \'n nommer, of tik hulle naam.',
  edit_client_name: '{customer} — wat moet hulle naam wees?\n\nReg soos dit is? Antwoord SKIP.',
  edit_client_address: 'En hulle adres?\n\nLos dit soos dit is? Antwoord SKIP.',
  edit_client_saved: 'Gestoor — {customer}.',

  help:
    'Dis wat ek kan doen:\n\n• MENU — alles, as \'n genommerde lys\n• Stuur my \'n werk → ek maak \'n kwotasie\n• Stuur my \'n rekening → ek hou dit by en herinner jou\n• QUOTES — jou onlangse kwotasies\n• BILLS — wat jy skuld\n• BANK — verander jou bankbesonderhede\n• LOGIN — kry jou dashboard-kode\n• LANGUAGE — verander taal\n• STOP — stop boodskappe',
  not_understood: 'Ek het dit nie heeltemal verstaan nie. Antwoord MENU om te sien wat ek kan doen.',
  save_failed: 'Iets het verkeerd geloop met stoor. Stuur dit asseblief weer.',
  cancelled: 'Gekanselleer. Antwoord MENU om te sien wat ek alles kan doen.',
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
