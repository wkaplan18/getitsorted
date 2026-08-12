// South African banks and their universal branch codes.
//
// Asked for as one question ("which bank?") rather than two, because almost
// nobody knows their branch code off the top of their head and every SA bank
// has a single universal code that works for every branch. Getting it wrong
// means a customer's EFT bounces, so deriving it beats asking.

type Bank = { name: string; branchCode: string; aliases: string[] }

const BANKS: Bank[] = [
  { name: 'FNB',              branchCode: '250655', aliases: ['fnb', 'first national', 'first national bank'] },
  { name: 'Standard Bank',    branchCode: '051001', aliases: ['standard', 'standard bank', 'stanbic', 'sbsa'] },
  { name: 'ABSA',             branchCode: '632005', aliases: ['absa', 'absa bank'] },
  { name: 'Nedbank',          branchCode: '198765', aliases: ['nedbank', 'ned bank', 'ned'] },
  { name: 'Capitec',          branchCode: '470010', aliases: ['capitec', 'capitec bank'] },
  { name: 'TymeBank',         branchCode: '678910', aliases: ['tyme', 'tymebank', 'tyme bank'] },
  { name: 'African Bank',     branchCode: '430000', aliases: ['african', 'african bank'] },
  { name: 'Investec',         branchCode: '580105', aliases: ['investec'] },
  { name: 'Discovery Bank',   branchCode: '679000', aliases: ['discovery', 'discovery bank'] },
  { name: 'Bank Zero',        branchCode: '888000', aliases: ['bank zero', 'bankzero', 'zero'] },
  { name: 'Bidvest Bank',     branchCode: '462005', aliases: ['bidvest', 'bidvest bank'] },
  { name: 'Sasfin Bank',      branchCode: '683000', aliases: ['sasfin', 'sasfin bank'] },
  { name: 'Ubank',            branchCode: '431010', aliases: ['ubank', 'u bank'] },
]

export type BankMatch = { name: string; branchCode: string | null }

/**
 * Resolves whatever the user typed to a bank name and universal branch code.
 *
 * An unrecognised bank is kept verbatim with a null branch code rather than
 * discarded — a quote showing the bank name and account number is still
 * payable, and inventing a branch code would not be.
 */
export function resolveBank(input: string): BankMatch {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!cleaned) return { name: input.trim(), branchCode: null }

  for (const bank of BANKS) {
    if (bank.aliases.some(alias => cleaned === alias)) {
      return { name: bank.name, branchCode: bank.branchCode }
    }
  }
  // Looser pass: "I bank with Capitec", "capitec savings account"
  for (const bank of BANKS) {
    if (bank.aliases.some(alias => cleaned.includes(alias))) {
      return { name: bank.name, branchCode: bank.branchCode }
    }
  }
  return { name: input.trim(), branchCode: null }
}

/** Digits only — people type account numbers with spaces and dashes. */
export function cleanAccountNumber(input: string): string {
  return input.replace(/\D/g, '')
}
