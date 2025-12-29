import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dotor - Privacy-First Personal Assistant',
  description: 'Search your emails, calendar, and messages without storing any data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
