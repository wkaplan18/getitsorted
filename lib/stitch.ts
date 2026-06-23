// Stitch PayKit — SA open banking payment initiation
// Docs: https://docs.stitch.money/payments/paykit

const TOKEN_URL = 'https://secure.stitch.money/connect/token'
const GRAPHQL_URL = 'https://api.stitch.money/graphql'

// Stitch bankId values for SA banks
const BANK_ID_MAP: Record<string, string> = {
  'fnb': 'fnb',
  'first national bank': 'fnb',
  'standard bank': 'standardbank',
  'standardbank': 'standardbank',
  'absa': 'absa',
  'nedbank': 'nedbank',
  'capitec': 'capitec',
  'capitec bank': 'capitec',
  'investec': 'investec',
  'tyme bank': 'tymebank',
  'tymebank': 'tymebank',
  'discovery bank': 'discovery',
  'discovery': 'discovery',
}

export function toBankId(bankName: string | null): string | null {
  if (!bankName) return null
  return BANK_ID_MAP[bankName.toLowerCase()] ?? null
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.STITCH_CLIENT_ID!,
      client_secret: process.env.STITCH_CLIENT_SECRET!,
      scope: 'client_paymentrequest',
      audience: TOKEN_URL,
    })
  })

  if (!res.ok) throw new Error(`Stitch token error: ${await res.text()}`)
  const data = await res.json()
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.value
}

export type PaymentInitResult = {
  paymentId: string
  redirectUrl: string
}

export async function createPaymentInitiation(input: {
  billId: string
  payeeName: string
  amount: number
  accountNumber: string
  bankId: string
  branchCode?: string | null
  reference?: string | null
  payerReference?: string | null
}): Promise<PaymentInitResult> {
  const token = await getAccessToken()
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/success?bill_id=${input.billId}`

  const mutation = `
    mutation CreatePayment($input: ClientPaymentInitiationRequestInput!) {
      clientPaymentInitiationRequestCreate(input: $input) {
        ... on ClientPaymentInitiationRequestCreated {
          paymentInitiationRequest {
            id
            url
          }
        }
        ... on PaymentInitiationRequestError {
          code
          message
        }
      }
    }
  `

  const variables = {
    input: {
      amount: { quantity: input.amount.toFixed(2), currency: 'ZAR' },
      payerReference: input.payerReference ?? 'Sorted',
      beneficiaryReference: input.reference ?? input.payeeName.slice(0, 20),
      externalReference: input.billId,
      beneficiary: {
        bankAccount: {
          name: input.payeeName,
          bankId: input.bankId,
          accountNumber: input.accountNumber,
        }
      },
      returnUrl,
    }
  }

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: mutation, variables })
  })

  const json = await res.json()
  const result = json?.data?.clientPaymentInitiationRequestCreate

  if (result?.paymentInitiationRequest) {
    return {
      paymentId: result.paymentInitiationRequest.id,
      redirectUrl: result.paymentInitiationRequest.url,
    }
  }

  throw new Error(`Stitch payment error: ${result?.message ?? JSON.stringify(json)}`)
}
