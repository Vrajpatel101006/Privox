import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { Toaster } from 'react-hot-toast';

// display: swap prevents FOIT (Flash of Invisible Text) — improves perceived speed
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Prinvox — 3D Printing Marketplace',
  description: 'Custom 3D printing on demand. Upload your design, get quotes from vendors, and track your order.',
  keywords: ['3D printing', 'marketplace', 'custom print', 'vendor', 'STL'],
  authors: [{ name: 'Prinvox' }],
  openGraph: {
    title: 'Prinvox — 3D Printing Marketplace',
    description: 'Custom 3D printing on demand.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <SocketProvider>
            {children}
            <Toaster position="top-right" />
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
