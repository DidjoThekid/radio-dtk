import './globals.css';

export const metadata = {
  title: 'Radio DTK',
  description: 'Radio DTK',
  icons: { icon: '/radio-dtk-logo.svg' },
};

export default function Layout({ children }) {
  return <html lang="fr"><body>{children}</body></html>;
}
