// A logo for the ~most tradespeople who don't have one.
//
// Deliberately NOT an AI-generated image: this appears on a document the
// tradesperson's customer sees, so it has to be instant, free per quote, and
// identical every time. A derived monogram — initials on a colour picked
// deterministically from the business name — is all of those. It's also
// rendered natively in both the PDF and the web page rather than uploaded as a
// file, so there is nothing to store, fetch, or break.

/** Up to two initials from the business name. "Sipho Plumbing" → "SP". */
export function initials(businessName: string): string {
  const words = businessName
    .trim()
    .split(/\s+/)
    // Drop the filler that would otherwise eat an initial: "The Best Plumbing"
    // should read TB, not TBP, and "Sipho & Sons" should read SS.
    .filter(w => !/^(the|and|of|&|pty|ltd|cc|inc)$/i.test(w.replace(/[^a-z&]/gi, '')))
    .filter(Boolean)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// A hand-picked spread rather than a hue formula: every one of these is dark
// enough for white text at 4.5:1, and none of them reads as a stock framework
// blue. Trades skew warm and earthy, so the set does too.
const PALETTE = [
  '#B4530A', // burnt amber — matches the quote accent
  '#1D5B4C', // deep teal
  '#7A2E2E', // oxblood
  '#2F4858', // slate blue
  '#5B4A1F', // olive bronze
  '#4A2B5E', // aubergine
  '#8A4B12', // rust
  '#1F4C6B', // petrol
]

/**
 * Stable colour for a business. Same name always yields the same colour, so a
 * tradesperson's mark never changes between quotes — which is the entire point
 * of a logo.
 */
export function monogramColor(businessName: string): string {
  let hash = 0
  for (let i = 0; i < businessName.length; i++) {
    hash = (hash * 31 + businessName.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export type Monogram = { text: string; color: string }

export function monogram(businessName: string): Monogram {
  return { text: initials(businessName), color: monogramColor(businessName) }
}
