import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sorted',
  description: 'Forward your bills. Get sorted.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='40' y2='40' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0%25' stop-color='%2322C55E'/%3E%3Cstop offset='50%25' stop-color='%2310B981'/%3E%3Cstop offset='100%25' stop-color='%2306B6D4'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='40' height='40' rx='11' fill='url(%23g)'/%3E%3Crect width='40' height='40' rx='11' fill='white' fill-opacity='0.08'/%3E%3Cellipse cx='20' cy='8' rx='14' ry='6' fill='white' fill-opacity='0.15'/%3E%3Cpath d='M9 20.5L16.5 28L31 13' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" />
      </head>
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
