import './globals.css';

export const metadata = {
  title: 'Radio DTK',
  description: 'Radio DTK',
  icons: {
    icon: '/radio-dtk-logo.svg',
    shortcut: '/radio-dtk-logo.svg',
    apple: '/radio-dtk-logo.svg',
  },
  themeColor: '#000000',
};

export default function Layout({ children }) {
  return <html lang="fr"><body>{children}</body></html>;
}
