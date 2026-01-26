import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TradeCraft AI - Autonomous Crypto Trading Platform',
  description: 'Build intelligent trading workflows with AI-powered decision making',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background-dark text-white font-display overflow-hidden selection:bg-primary/30">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
