import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { SupabaseProvider } from '@/lib/SupabaseProvider';
import { SupabaseAuthGuard } from '@/lib/SupabaseAuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Architectural Ledger CRM',
  description: 'High-end Real Estate CRM for luxury property portfolios.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ErrorBoundary>
          <SupabaseProvider>
            <SupabaseAuthGuard>
              {children}
            </SupabaseAuthGuard>
          </SupabaseProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
