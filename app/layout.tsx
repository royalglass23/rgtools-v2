import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  // Production (rgtools.co.nz, main) shows the Royal Glass brand;
  // every other environment (Vercel Preview / local dev) keeps the rgtools default.
  const isProduction = process.env.VERCEL_ENV === 'production';

  return {
    title: isProduction ? 'Royal Glass' : 'rgtools',
    description: 'Royal Glass internal tools',
    icons: {
      icon: isProduction ? '/favicon-royalglass.png' : '/favicon-rgtools.ico',
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
