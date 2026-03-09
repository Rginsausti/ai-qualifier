import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { PageTransition } from "@/components/page-transition";
import { PwaRegister } from "@/components/pwa-register";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agente Alma · Alimentación saludable con cariño",
  description:
    "SPA educativa que registra tus rutinas, gestiona tu despensa y te acompaña a comer cada día más saludable.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Agente Alma",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE } from "@/i18n/settings";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const lang = cookieStore.get("alma-language")?.value || DEFAULT_LANGUAGE;

  return (
    <html lang={lang}>
      <body
        className={`${plusJakarta.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          id="alma-capture-install-prompt"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: "window.__almaDeferredInstallPrompt=window.__almaDeferredInstallPrompt||null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__almaDeferredInstallPrompt=e;window.dispatchEvent(new Event('alma-install-prompt-ready'));});window.addEventListener('appinstalled',function(){window.__almaDeferredInstallPrompt=null;});",
          }}
        />
        <PwaRegister />
        <I18nProvider initialLanguage={lang}>
          <PageTransition>{children}</PageTransition>
        </I18nProvider>
      </body>
    </html>
  );
}
