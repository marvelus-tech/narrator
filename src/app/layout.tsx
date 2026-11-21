import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { siteUrl } from "@/server/ids";
import "./globals.css";

const display = localFont({
  src: "../fonts/barlow-condensed-600.woff2",
  weight: "600",
  style: "normal",
  variable: "--display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "NR8R", template: "%s" },
  description: "Turn one film prompt into an editable shot list and a priced still or clip.",
  applicationName: "NR8R",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
