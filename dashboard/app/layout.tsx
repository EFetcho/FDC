import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Source_Sans_3, Space_Grotesk } from "next/font/google";
import { THEME_COOKIE, themeBootScript } from "../lib/theme";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "FDC Operations",
  description: "Personal operations dashboard for FDC Event Technology",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = saved === "light" || saved === "dark" ? saved : undefined;

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <body>
        <Script id="fdc-theme" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        {children}
        <div className="watermark" aria-hidden="true" />
      </body>
    </html>
  );
}
