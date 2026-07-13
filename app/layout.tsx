import type {Metadata} from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { BRANDING } from './config/branding';
import { ThemeProvider } from './contexts/ThemeContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: BRANDING.shortName,
  description: BRANDING.description,
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRANDING.shortName,
  },
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
