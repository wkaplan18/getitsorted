import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sorted',
  description: 'Forward your bills. Get sorted.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sorted',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
