import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tasqyn — карта паводков Уральска в реальном времени",
  description:
    "Жители Уральска отмечают уровень воды на своей улице. Данные появляются на карте мгновенно — раньше официальных сводок.",
  applicationName: "Tasqyn",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tasqyn", statusBarStyle: "default" },
  openGraph: {
    title: "Tasqyn — карта паводков Уральска",
    description:
      "Краудсорс-карта паводка. Один клик — и ваша улица на карте для соседей и ДЧС.",
    type: "website",
    locale: "ru_KZ",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={manrope.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
