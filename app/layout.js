import Script from 'next/script';

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
