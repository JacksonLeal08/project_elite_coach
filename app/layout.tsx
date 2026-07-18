import type {Metadata} from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { BRANDING } from './config/branding';
import { ThemeProvider } from './contexts/ThemeContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: BRANDING.name,
  description: BRANDING.description,
  manifest: '/manifest.json',
  metadataBase: new URL('https://elitecoachcrm.com.br'),
  icons: {
    icon: '/favicon.png',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRANDING.shortName,
  },
  openGraph: {
    title: BRANDING.name,
    description: BRANDING.description,
    url: 'https://elitecoachcrm.com.br',
    siteName: BRANDING.name,
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: BRANDING.name,
      }
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: BRANDING.name,
    description: BRANDING.description,
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'mobile-web-app-capable': 'yes',
  }
};

export const viewport = {
  themeColor: '#0a1410',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="font-sans" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('SW registrado com sucesso:', reg.scope);
                reg.update();
              }).catch(function(err) {
                console.log('Erro ao registrar SW:', err);
              });
            });
          }
        ` }} />
      </body>
    </html>
  );
}
