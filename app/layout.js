import './globals.css';

export const metadata = {
  title: 'Radio DTK',
  description: 'Radio DTK',
  icons: {
    icon: 'https://raw.githubusercontent.com/DidjoThekid/radio-dtk/main/Logo%20radio%20DTK%20avec%20%C3%A9toile%20rouge.png',
    shortcut: 'https://raw.githubusercontent.com/DidjoThekid/radio-dtk/main/Logo%20radio%20DTK%20avec%20%C3%A9toile%20rouge.png',
    apple: 'https://raw.githubusercontent.com/DidjoThekid/radio-dtk/main/Logo%20radio%20DTK%20avec%20%C3%A9toile%20rouge.png',
  },
  themeColor: '#000000',
};

export default function Layout({ children }) {
  return <html lang="fr"><body>{children}</body></html>;
}
