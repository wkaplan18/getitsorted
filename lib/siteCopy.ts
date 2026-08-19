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

/**
 * The trigger word each language's page prints and prefills.
 *
 * Both are real commands the webhook already accepted. Making the isiZulu page
 * use its own means the tap tells Sorted which page he came from, so a new user
 * is never asked to pick a language he has just picked on the website. Someone
 * who hand-types plain QUOTE off that page still works — he just gets the
 * language question, which is the fallback, not a fault.
 */
export const LANG_TRIGGER: Record<SiteLang, string> = { en: 'quote', zu: 'i-quote' }

/** Path each language lives at. English is the root. */
export const LANG_PATH: Record<SiteLang, string> = { en: '/', zu: '/zu' }
export const LANG_LABEL: Record<SiteLang, string> = { en: 'English', zu: 'isiZulu' }
/**
 * Short form for the nav toggle.
 *
 * Was 'EN' / 'ZU'. Two-letter codes are a developer's shorthand: an isiZulu
 * speaker scanning a nav does not know that 'ZU' is his language, so the pill
 * that exists to rescue him was invisible. The whole word is wider, which the
 * handset rule below the nav pays for by shrinking the pills, not by dropping
 * them.
 */
export const LANG_SHORT: Record<SiteLang, string> = { en: 'English', zu: 'Zulu' }

export type SiteCopy = {
  htmlLang: string
  meta: { title: string; description: string }
  nav: { quotes: string; pricing: string; who: string; openApp: string }
  hero: {
    eyebrow: string
    titleTop: string
    titleAccent: string
    body: string
    // The WhatsApp number, spelled out as an instruction. Split into parts
    // rather than one interpolated sentence because the number itself is set
    // in bigger type — and because QUOTE is a trigger word the webhook
    // matches, so it is never translated.
    number: { before: string; word: string; middle: string; note: string }
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
  who: {
    label: string
    title: string
    body: string
    cta: string
    items: Array<{ emoji: string; title: string; desc: string }>
  }
  pricing: {
    label: string
    title: string
    body: string
    plans: Array<{ name: string; price: string; priceNote: string; items: string[] }>
    feeTitle: string
    feeBody: string
    // Column headings for the worked example. The amounts themselves are
    // computed from lib/paystack.ts, never typed here, so the table cannot
    // drift from what the checkout actually charges.
    feeCols: [string, string, string]
    feeNote: string
    minNote: string
  }
  contact: {
    label: string
    title: string
    body: string
    operatorLabel: string
    addressLabel: string
    emailLabel: string
    replyNote: string
  }
  cta: { badge: string; titleA: string; word: string; titleB: string; body: string; button: string; note: string }
  footer: { built: string; terms: string; privacy: string; refunds: string }
}

const en: SiteCopy = {
  htmlLang: 'en',
  meta: {
    title: 'Sorted — Send a professional quote straight from WhatsApp',
    description:
      'Answer three questions on WhatsApp and get back a branded PDF quote with your logo and banking details. Built for South African tradespeople.',
  },
  nav: { quotes: 'Send quotes', pricing: 'Pricing', who: "Who it's for", openApp: 'Open app →' },
  hero: {
    eyebrow: 'For plumbers, electricians, painters & every one-person trade',
    titleTop: 'Send a professional quote',
    titleAccent: 'straight from WhatsApp.',
    body:
      'Answer three questions on WhatsApp. Get back a branded PDF quote with your logo, your banking details, and a link you forward to your client. Under a minute, every time.',
    number: {
      before: 'Text',
      word: 'QUOTE',
      middle: 'to',
      note: "Free. That one message starts your first quote — your logo, your banking details, your client seeing a real company.",
    },
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
  quotes: {
    label: 'Quotes',
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
  pricing: {
    label: 'Pricing',
    title: 'Free to use. You keep every rand you quote.',
    body:
      'Sorted costs you nothing to sign up for and nothing per month. The only fee is on card payments, it is added to what your client pays, and you still receive your quote total to the cent.',
    plans: [
      {
        name: 'Sending quotes',
        price: 'Free',
        priceNote: 'No signup fee. No monthly fee.',
        items: [
          'Unlimited quotes',
          'Your logo, or we make you one',
          'Branded PDF and a link to forward',
          'Opened and paid alerts on WhatsApp',
          'Bill reminders and your dashboard',
        ],
      },
      {
        name: 'Getting paid by EFT',
        price: 'Free',
        priceNote: 'No fee from us, ever.',
        items: [
          'Your bank, account and branch code on every quote',
          'The quote number as the payment reference',
          'Your client pays straight into your account',
        ],
      },
      {
        name: 'Getting paid by card',
        price: 'Card payment fee',
        priceNote: 'Paid by your client, shown before they confirm.',
        items: [
          'You receive your quote total in full',
          'Covers card processing plus R2.00 to Sorted',
          'Settles into your own bank account',
          'Card is offered on quotes of R150 and up',
        ],
      },
    ],
    feeTitle: 'What the fee actually looks like',
    feeBody:
      'Your client sees one line called Card payment fee and the total before they pay. Nothing comes off your side.',
    feeCols: ['Your quote', 'Your client pays', 'You receive'],
    feeNote:
      'The fee is mostly the card network\u2019s cost, not ours \u2014 Sorted keeps R2.00 of it per paid quote. Amounts above are worked out by the same code that runs the checkout.',
    minNote: 'Below R150 the card option is not shown at all, because a fixed fee on a small callout is not worth it. EFT is always there.',
  },
  contact: {
    label: 'Contact',
    title: 'Real people, real business.',
    body: 'Questions about a quote, a payment or your account \u2014 email us and a person answers.',
    operatorLabel: 'Operated by',
    addressLabel: 'Address',
    emailLabel: 'Email',
    replyNote: 'We answer email enquiries within two business days.',
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
  footer: { built: 'Built in South Africa 🇿🇦', terms: 'Terms', privacy: 'Privacy', refunds: 'Refunds' },
}

const zu: SiteCopy = {
  htmlLang: 'zu',
  meta: {
    title: 'Sorted — Thumela i-quote esezingeni eliphezulu nge-WhatsApp',
    description:
      'Phendula imibuzo emithathu ku-WhatsApp uthole i-PDF quote enelogo yakho nemininingwane yebhange. Yenzelwe abasebenzi baseNingizimu Afrika.',
  },
  nav: { quotes: 'Thumela ama-quote', pricing: 'Amanani', who: 'Ingeyabani', openApp: 'Vula i-app →' },
  hero: {
    eyebrow: 'Yabo bonke oplama, abasebenza ngogesi, abapendi, abalungisa izingadi, abenzi bezinzipho, abalungisi bezinwele nawo wonke umuntu ozisebenzayo',
    titleTop: 'Thumela i-quote',
    titleAccent: 'nge-WhatsApp.',
    body:
      'Phendula imibuzo emithathu ku-WhatsApp. Uthola i-PDF quote esezingeni eliphezulu enelogo yakho, imininingwane yebhange lakho, nesixhumanisi osidlulisela ikhasimende lakho. Ngaphansi komzuzu, njalo.',
    number: {
      before: 'Thumela u-',
      word: 'I-QUOTE',
      middle: 'ku-',
      note: 'Mahhala. Lowo mlayezo owodwa uqala i-quote yakho yokuqala — ilogo yakho, imininingwane yebhange lakho, ikhasimende lakho libona inkampani yangempela.',
    },
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
  quotes: {
    label: 'Ama-quote',
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
  pricing: {
    label: 'Amanani',
    title: 'Mahhala ukuyisebenzisa. Uthola yonke imali oyibizile.',
    body:
      'USorted awukubizi lutho ukubhalisa futhi awunayo inkokhelo yanyanga zonke. Inkokhelo kuphela isekukhokheni ngekhadi, yengezwa kulokho ikhasimende lakho elikukhokhayo, futhi wena uthola isamba se-quote yakho ngokugcwele.',
    plans: [
      {
        name: 'Ukuthumela ama-quote',
        price: 'Mahhala',
        priceNote: 'Ayikho inkokhelo yokubhalisa. Ayikho eyanyanga zonke.',
        items: [
          'Ama-quote angenamkhawulo',
          'Ilogo yakho, noma sikwenzele',
          'I-PDF enelogo nesixhumanisi osidluliselayo',
          'Izaziso zokuvulwa nokukhokhwa ku-WhatsApp',
          'Izikhumbuzo zezikweletu ne-dashboard yakho',
        ],
      },
      {
        name: 'Ukukhokhelwa nge-EFT',
        price: 'Mahhala',
        priceNote: 'Ayikho inkokhelo evela kithi, nanini.',
        items: [
          'Ibhange lakho, i-akhawunti nekhodi yegatsha kuwo wonke ama-quote',
          'Inombolo ye-quote njengenkomba yenkokhelo',
          'Ikhasimende lakho likhokha ngqo ku-akhawunti yakho',
        ],
      },
      {
        name: 'Ukukhokhelwa ngekhadi',
        price: 'Inkokhelo yekhadi',
        priceNote: 'Ikhokhwa ikhasimende lakho, ibonakala ngaphambi kokuqinisekisa.',
        items: [
          'Uthola isamba se-quote yakho ngokugcwele',
          'Ihlanganisa izindleko zekhadi kanye no-R2.00 kuSorted',
          'Ingena ngqo ku-akhawunti yakho yasebhange',
          'Ikhadi linikezwa kuma-quote aqala ku-R150',
        ],
      },
    ],
    feeTitle: 'Ibukeka kanjani ngempela le nkokhelo',
    feeBody:
      'Ikhasimende lakho libona umugqa owodwa othi Inkokhelo yekhadi nesamba ngaphambi kokukhokha. Akukho okususwa kwelakho ihlangothi.',
    feeCols: ['I-quote yakho', 'Ikhasimende likhokha', 'Wena uthola'],
    feeNote:
      'Inkokhelo ingeyenethiwekhi yamakhadi ikakhulukazi, hhayi eyethu \u2014 uSorted uthatha u-R2.00 kuyo nge-quote ngayinye ekhokhiwe. Amanani angenhla abalwa yikhodi efanayo esebenza ekukhokheni.',
    minNote: 'Ngaphansi kuka-R150 ikhethelo lekhadi alibonakali nhlobo, ngoba inkokhelo emisiwe emsebenzini omncane ayifanele. I-EFT ihlala ikhona.',
  },
  contact: {
    label: 'Xhumana nathi',
    title: 'Abantu bangempela, ibhizinisi langempela.',
    body: 'Imibuzo mayelana ne-quote, inkokhelo noma i-akhawunti yakho \u2014 sithumele i-imeyili, kuphendula umuntu.',
    operatorLabel: 'Iphethwe ngu',
    addressLabel: 'Ikheli',
    emailLabel: 'I-imeyili',
    replyNote: 'Siphendula imibuzo nge-imeyili zingakapheli izinsuku ezimbili zomsebenzi.',
  },
  cta: {
    badge: 'Isiyasebenza',
    titleA: 'Thumela u-',
    word: 'I-QUOTE',
    titleB: '. Yilokho kuphela.',
    body: 'Ayikho i-app oyilandayo, alikho ifomu lokubhalisa, alikho iphasiwedi. I-WhatsApp kuphela.',
    button: 'Qala ku-WhatsApp →',
    note: 'Iphendula ngesiNgisi noma ngesiZulu.',
  },
  footer: { built: 'Yakhelwe eNingizimu Afrika 🇿🇦', terms: 'Imigomo', privacy: 'Ubumfihlo', refunds: 'Ukubuyiselwa' },
}

const COPY: Record<SiteLang, SiteCopy> = { en, zu }

export function siteCopy(lang: SiteLang): SiteCopy {
  return COPY[lang] ?? COPY.en
}
