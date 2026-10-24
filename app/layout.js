import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'Radio DTK',
  description: 'Radio DTK',
  icons: {
    icon: '/radio-dtk-logo.svg',
    shortcut: '/radio-dtk-logo.svg',
  },
};

export default function Layout({ children }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Script src="/cover-live.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
