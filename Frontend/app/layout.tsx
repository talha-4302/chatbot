import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Atlas AI',
  description: 'A polished AI chat workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
