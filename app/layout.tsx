import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'C2C Job Copilot — Data Engineer Contract Search',
  description:
    'AI-powered job search and application assistant for Data Engineer C2C contract roles in the US. Discover C2C-friendly openings, score fit, tailor resumes truthfully, and track applications.',
  keywords: 'C2C, Corp-to-Corp, Data Engineer, contract jobs, resume tailor, job tracker',
  openGraph: {
    title: 'C2C Job Copilot',
    description: 'AI-powered contract job search for Data Engineers',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-surface-base text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
