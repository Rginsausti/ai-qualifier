import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { PageTransition } from "@/components/page-transition";

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
      { url: "/images/girl-avatar.png", sizes: "192x192", type: "image/png" },
      { url: "/images/girl-avatar.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/images/girl-avatar.png" },
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
        <I18nProvider initialLanguage={lang}>
          <PageTransition>{children}</PageTransition>
        </I18nProvider>
      </body>
    </html>
  );
}
