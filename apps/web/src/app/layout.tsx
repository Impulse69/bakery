import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bread Faculty — Owner Dashboard',
  description: 'Artisanal bakery management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f5f6fa] text-[#131b2e] antialiased">{children}</body>
    </html>
  );
}
