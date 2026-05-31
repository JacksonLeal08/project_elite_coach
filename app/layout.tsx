import type {Metadata} from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: 'Elite Coach',
  description: 'Gestão de alta performance.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Elite Coach',
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
    <html lang="pt-BR" className={`${inter.variable} ${montserrat.variable} dark`}>
      <body className="bg-zinc-950 text-zinc-100 font-sans" suppressHydrationWarning>
        {children}
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
