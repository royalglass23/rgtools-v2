import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Royal Glass Catalog',
  description: 'Royal Glass public product catalog placeholder.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
