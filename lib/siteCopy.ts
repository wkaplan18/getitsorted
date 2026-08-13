// Marketing copy for the public landing page, per language.
//
// Separate from lib/i18n.ts on purpose: that file is WhatsApp reply strings
// (short, transactional, sent by the bot); this is the pitch. They change for
// different reasons and are written by different hands.
//
// Same rule as lib/i18n.ts: money, names, dates and document numbers are never
// translated. The demo quote shows "Mrs Naidoo" and "R3,750.00" identically in
// every language — only the labels around them change.
//
// NOTE FOR REVIEW: the isiZulu below needs a native-speaker pass before this is
// pointed at real users. Marketing copy carries the pitch, and a translation
// that reads as machine-made undoes the credibility the page is trying to earn.

export const SITE_LANGS = ['en', 'zu'] as const
export type SiteLang = (typeof SITE_LANGS)[number]

/** Path each language lives at. English is the root. */
export const LANG_PATH: Record<SiteLang, string> = { en: '/', zu: '/zu' }
export const LANG_LABEL: Record<SiteLang, string> = { en: 'English', zu: 'isiZulu' }

export type SiteCopy = {
  htmlLang: string
  meta: { title: string; description: string }
  nav: { quotes: string; bills: string; who: string; openApp: string }
  hero: {
    eyebrow: string
    titleTop: string
    titleAccent: string
    body: string
    ctaPrimary: string
    ctaSecondary: string
    chips: string[]
  }
  phone: {
    online: string
    quote: string
    step1: string
    client: string
    step3: string
    work: string
    reply: string
    thanks: string
  }
  float: { opened: string; ago: string }
  lanes: {
    intro: string
    in: { kicker: string; title: string; body: string; cta: string }
    out: { kicker: string; title: string; body: string; cta: string }
  }
  quotes: {
    label: string
    title: string
    body: string
    bodyStrong: string
    steps: Array<{ title: string; body: string }>
    proofTitle: string
    proofBody: string
    proofItems: Array<[string, string]>
  }
  doc: {
    quotation: string
    quoteFor: string
    total: string
    payByEft: string
    bank: string
    account: string
    branch: string
    reference: string
    trade: string
  }
  banks: string
  bills: {
    label: string
    title: string
    body: string
    cards: Array<{ title: string; body: string }>
    cta: string
  }
  who: {
    label: string
    title: string
    body: string
    cta: string
    items: Array<{ emoji: string; title: string; desc: string }>
  }
  cta: { badge: string; titleA: string; word: string; titleB: string; body: string; button: string; note: string }
  footer: { built: string }
}

const en: SiteCopy = {
  htmlLang: 'en',
  meta: {
    title: 'Sorted — Send a professional quote straight from WhatsApp',
    description:
      'Answer three questions on WhatsApp and get back a branded PDF quote with your logo and banking details. Built for South African tradespeople.',
  },
  nav: { quotes: 'Send quotes', bills: 'Track bills', who: "Who it's for", openApp: 'Open app →' },
  hero: {
    eyebrow: 'For plumbers, electricians, painters & every one-person trade',
    titleTop: 'Send a professional quote',
    titleAccent: 'straight from WhatsApp.',
    body:
      'Answer three questions on WhatsApp. Get back a branded PDF quote with your logo, your banking details, and a link you forward to your client. Under a minute, every time.',
    ctaPrimary: 'Send your first quote →',
    ctaSecondary: 'See how it works',
    chips: ['No app to download', 'English & isiZulu', 'We make your logo', 'Your banking details on every quote'],
  },
  phone: {
    online: 'Online',
    quote: 'quote',
    step1: 'Step 1 of 3',
    client: "— What is your client's name?",
    step3: 'Step 3 of 3',
    work: '— What work are you doing, and what are you charging?',
    reply: 'Paint 3 bedrooms R850 each, materials R1200',
    thanks: 'Thanks. Putting your quote together now…',
  },
  float: { opened: 'Mrs Naidoo opened it', ago: '2 minutes ago' },
  lanes: {
    intro: 'One WhatsApp number. Both sides of your money.',
    in: {
      kicker: 'Money in',
      title: 'Send a quote, get paid',
      body: 'Three questions on WhatsApp and your client has a branded PDF with your banking details on it.',
      cta: 'How quoting works',
    },
    out: {
      kicker: 'Money out',
      title: 'Never miss a bill again',
      body: "Forward any invoice and Sorted reads the amount, due date and bank details, then reminds you before it's due.",
      cta: 'How bills work',
    },
  },
  quotes: {
    label: 'Money in · Quotes',
    title: 'Three questions. One quote.',
    body: 'You text ',
    bodyStrong: 'QUOTE',
    steps: [
      { title: 'Who is it for?', body: "Your client's name, then their address. No address? Reply N/A and Sorted moves on." },
      { title: 'What are you charging?', body: 'Type it how you speak: "Paint 3 bedrooms R850 each, materials R1200." Sorted splits it into priced lines and adds it up.' },
      { title: 'Forward the link', body: 'Back comes a PDF with your logo, your banking details and the quote number as the reference. Sorted tells you when your client opens it.' },
    ],
    proofTitle: 'Your client sees a real company.',
    proofBody:
      'Not a WhatsApp message with a number in it. A proper quote, on its own page, that opens on any phone and downloads as a PDF.',
    proofItems: [
      ['Your logo', 'Send yours, or Sorted makes you one from your business name.'],
      ['Your banking details', 'Bank, account and branch code, with the quote number as the reference.'],
      ['Opened & paid alerts', 'A WhatsApp the moment your client opens the quote.'],
    ],
  },
  doc: {
    quotation: 'Quotation',
    quoteFor: 'QUOTE FOR',
    total: 'Total',
    payByEft: 'PAY BY EFT',
    bank: 'Bank',
    account: 'Account',
    branch: 'Branch',
    reference: 'Reference',
    trade: 'Plumbing',
  },
  banks: 'Works with every SA bank',
  bills: {
    label: 'Money out · Bills',
    title: 'And the bills you owe, sorted too.',
    body: "Forward an invoice — PDF, photo, or a plain WhatsApp message. Sorted reads it, files it, and reminds you before it's due.",
    cards: [
      { title: 'Forward anything', body: 'Your supplier emails a PDF. The municipality sends a photo. Someone texts you "pay the vet R2000." Forward it and it’s captured — amount, due date and banking details read automatically.' },
      { title: 'Bank details remembered', body: "Enter a payee's account once. Sorted keeps it for every future invoice from them, so a bill with missing details still arrives payable." },
      { title: "Reminders before it's due", body: 'A WhatsApp three days before every due date, with the banking details attached ready to copy. Overdue bills get flagged red on your dashboard.' },
      { title: 'Someone else can send it', body: 'Add a trusted sender — a partner, an office manager, a supplier — and what they forward lands in your dashboard. You get pinged the moment it does.' },
    ],
    cta: 'Open your dashboard →',
  },
  who: {
    label: "Who it's for",
    title: 'Anyone who does the work and does the paperwork',
    body: 'If you quote from the back of your bakkie, chase your own payments, and do the admin at 9pm — Sorted is for you.',
    cta: 'Send your first quote →',
    items: [
      { emoji: '🔧', title: 'Plumbers & electricians', desc: 'Price a callout on site and send it before you leave the driveway.' },
      { emoji: '🎨', title: 'Painters & tilers', desc: 'Per-room pricing, split into lines automatically. "3 bedrooms R850 each."' },
      { emoji: '🌿', title: 'Landscapers & cleaners', desc: 'Regular clients, repeat quotes. Your details are already saved.' },
      { emoji: '🚚', title: 'Movers & handymen', desc: 'A written quote makes you the one they trust out of three.' },
    ],
  },
  cta: {
    badge: 'Now live',
    titleA: 'Text ',
    word: 'QUOTE',
    titleB: ". That's the whole thing.",
    body: 'No app to download, no signup form, no password. Just WhatsApp.',
    button: 'Start on WhatsApp →',
    note: 'Replies in English or isiZulu.',
  },
  footer: { built: 'Built in South Africa 🇿🇦' },
}

const zu: SiteCopy = {
  htmlLang: 'zu',
  meta: {
    title: 'Sorted — Thumela i-quote esezingeni eliphezulu nge-WhatsApp',
    description:
      'Phendula imibuzo emithathu ku-WhatsApp uthole i-PDF quote enelogo yakho nemininingwane yebhange. Yenzelwe abasebenzi baseNingizimu Afrika.',
  },
  nav: { quotes: 'Thumela ama-quote', bills: 'Landelela amabhili', who: 'Ingeyabani', openApp: 'Vula i-app →' },
  hero: {
    eyebrow: 'Yabo bonke ababhali bamanzi, ugesi, abapendi nawo wonke umuntu ozisebenzayo',
    titleTop: 'Thumela i-quote',
    titleAccent: 'ngqo nge-WhatsApp.',
    body:
      'Phendula imibuzo emithathu ku-WhatsApp. Uthola i-PDF quote esezingeni eliphezulu enelogo yakho, imininingwane yebhange lakho, nesixhumanisi osidlulisela ikhasimende lakho. Ngaphansi komzuzu, njalo.',
    ctaPrimary: 'Thumela i-quote yakho yokuqala →',
    ctaSecondary: 'Bona ukuthi kusebenza kanjani',
    chips: ['Ayikho i-app oyilandayo', 'IsiNgisi nesiZulu', 'Sikwenzela ilogo', 'Imininingwane yebhange kuwo wonke ama-quote'],
  },
  phone: {
    online: 'Ku-inthanethi',
    quote: 'quote',
    step1: 'Isinyathelo 1 kwezi-3',
    client: '— Ngubani igama lekhasimende lakho?',
    step3: 'Isinyathelo 3 kwezi-3',
    work: '— Uwenza muphi umsebenzi, futhi ubiza malini?',
    reply: 'Penda amakamelo ama-3 R850 ngalinye, izinto R1200',
    thanks: 'Ngiyabonga. Ngiyalungisa i-quote yakho manje…',
  },
  float: { opened: 'U-Mrs Naidoo uyivulile', ago: 'emizuzwini emi-2 edlule' },
  lanes: {
    intro: 'Inombolo eyodwa ye-WhatsApp. Zombili izinhlangothi zemali yakho.',
    in: {
      kicker: 'Imali engenayo',
      title: 'Thumela i-quote, uthole imali',
      body: 'Imibuzo emithathu ku-WhatsApp bese ikhasimende lakho lithola i-PDF enemininingwane yebhange lakho.',
      cta: 'Ama-quote asebenza kanjani',
    },
    out: {
      kicker: 'Imali ephumayo',
      title: 'Ungaphuthelwa yibhili futhi',
      body: 'Dlulisela noma yiluphi u-invoice bese uSorted afunde inani, usuku lokugcina nemininingwane yebhange, akukhumbuze ngaphambi kwesikhathi.',
      cta: 'Amabhili asebenza kanjani',
    },
  },
  quotes: {
    label: 'Imali engenayo · Ama-quote',
    title: 'Imibuzo emithathu. I-quote eyodwa.',
    body: 'Uthumela ',
    bodyStrong: 'QUOTE',
    steps: [
      { title: 'Ingeyabani?', body: 'Igama lekhasimende lakho, bese kuba ikheli labo. Awunalo ikheli? Phendula ngo-N/A bese uSorted uyaqhubeka.' },
      { title: 'Ubiza malini?', body: 'Bhala njengoba ukhuluma: "Penda amakamelo ama-3 R850 ngalinye, izinto R1200." USorted uwahlukanisa abe yimigqa enamanani bese ewahlanganisa.' },
      { title: 'Dlulisela isixhumanisi', body: 'Kubuya i-PDF enelogo yakho, imininingwane yebhange lakho nenombolo ye-quote njengenkomba. USorted uyakutshela uma ikhasimende lakho liyivula.' },
    ],
    proofTitle: 'Ikhasimende lakho libona inkampani yangempela.',
    proofBody:
      'Hhayi umlayezo we-WhatsApp onenombolo. I-quote yangempela, ekhasini layo, evulekayo kunoma iyiphi ifoni futhi elandwe njenge-PDF.',
    proofItems: [
      ['Ilogo yakho', 'Thumela eyakho, noma uSorted akwenzele ngegama lebhizinisi lakho.'],
      ['Imininingwane yebhange lakho', 'Ibhange, i-akhawunti nekhodi yegatsha, nenombolo ye-quote njengenkomba.'],
      ['Izaziso zokuvulwa nokukhokhwa', 'I-WhatsApp ngaso leso sikhathi ikhasimende livula i-quote.'],
    ],
  },
  doc: {
    quotation: 'I-Quote',
    quoteFor: 'I-QUOTE YAKA',
    total: 'Isamba',
    payByEft: 'KHOKHA NGE-EFT',
    bank: 'Ibhange',
    account: 'I-akhawunti',
    branch: 'Igatsha',
    reference: 'Inkomba',
    trade: 'Amanzi nezimpompi',
  },
  banks: 'Isebenza nawo wonke amabhange aseNingizimu Afrika',
  bills: {
    label: 'Imali ephumayo · Amabhili',
    title: 'Namabhili owakweletayo, alungisiwe nawo.',
    body: 'Dlulisela u-invoice — i-PDF, isithombe, noma umlayezo nje we-WhatsApp. USorted uyawufunda, awugcine, akukhumbuze ngaphambi kwesikhathi.',
    cards: [
      { title: 'Dlulisela noma yini', body: 'Umthengisi wakho uthumela i-PDF nge-imeyili. Umasipala uthumela isithombe. Othile uthumela umlayezo othi "khokhela udokotela wezilwane u-R2000." Kudluliseleni bese kuyagcinwa — inani, usuku lokugcina nemininingwane yebhange kufundwa ngokuzenzakalela.' },
      { title: 'Imininingwane yebhange iyakhunjulwa', body: 'Faka i-akhawunti yomuntu okhokhelwayo kanye. USorted uyayigcina kuwo wonke ama-invoice azayo avela kuye, ngakho ibhili elingenayo yonke imininingwane lisafika likhokheka.' },
      { title: 'Izikhumbuzo ngaphambi kwesikhathi', body: 'I-WhatsApp izinsuku ezintathu ngaphambi kosuku ngalunye lokugcina, nemininingwane yebhange esilungele ukukopishwa. Amabhili adlulelwe yisikhathi akhonjiswa ngokubomvu ku-dashboard yakho.' },
      { title: 'Omunye umuntu angathumela', body: 'Faka umthumeli othembekile — umlingani, umphathi wehhovisi, umthengisi — bese lokho abakudlulisayo kufika ku-dashboard yakho. Uyaziswa ngaso leso sikhathi.' },
    ],
    cta: 'Vula i-dashboard yakho →',
  },
  who: {
    label: 'Ingeyabani',
    title: 'Noma ubani owenza umsebenzi futhi enze nomsebenzi wamaphepha',
    body: 'Uma unikeza ama-quote usemuva kwebakkie yakho, ulandelela izinkokhelo zakho, wenze nomsebenzi wamaphepha ngo-9 ebusuku — uSorted ungowakho.',
    cta: 'Thumela i-quote yakho yokuqala →',
    items: [
      { emoji: '🔧', title: 'Ababhali bamanzi nogesi', desc: 'Nikeza intengo yomsebenzi usendaweni bese uyithumela ungakashiyi indawo.' },
      { emoji: '🎨', title: 'Abapendi nabafaki bamathayela', desc: 'Intengo ngekamelo ngalinye, ihlukaniswe ngokuzenzakalela. "Amakamelo ama-3 R850 ngalinye."' },
      { emoji: '🌿', title: 'Abalimi bezingadi nabahlanzi', desc: 'Amakhasimende avamile, ama-quote aphindaphindiwe. Imininingwane yakho isivele igciniwe.' },
      { emoji: '🚚', title: 'Abathuthi nabakhandi', desc: 'I-quote ebhaliwe yenza ube nguwe abamethembayo kwabathathu.' },
    ],
  },
  cta: {
    badge: 'Isiyasebenza',
    titleA: 'Thumela u-',
    word: 'QUOTE',
    titleB: '. Yilokho kuphela.',
    body: 'Ayikho i-app oyilandayo, alikho ifomu lokubhalisa, alikho iphasiwedi. I-WhatsApp kuphela.',
    button: 'Qala ku-WhatsApp →',
    note: 'Iphendula ngesiNgisi noma ngesiZulu.',
  },
  footer: { built: 'Yakhelwe eNingizimu Afrika 🇿🇦' },
}

const COPY: Record<SiteLang, SiteCopy> = { en, zu }

export function siteCopy(lang: SiteLang): SiteCopy {
  return COPY[lang] ?? COPY.en
}
