import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
