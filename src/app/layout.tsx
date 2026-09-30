import type { Metadata, Viewport } from "next";
import { Bowlby_One, Chivo, JetBrains_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const bowlby = Bowlby_One({ weight: "400", subsets: ["latin"], variable: "--font-bowlby" });
const chivo = Chivo({ subsets: ["latin"], variable: "--font-chivo" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Napfpost",
  description: "Eine Person erledigt es – die ganze Familie weiß Bescheid.",
  applicationName: "Napfpost",
  appleWebApp: { capable: true, title: "Napfpost", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6ecea" },
    { media: "(prefers-color-scheme: dark)", color: "#141b21" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${bowlby.variable} ${chivo.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
