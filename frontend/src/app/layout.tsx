import type { Metadata } from "next";
import { Web3Provider } from "@/components/Web3Provider";
import { LocaleProvider } from "@/lib/i18n/context";
import { ArchitectModeProvider } from "@/lib/context/ArchitectModeContext";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mana OS",
  description: "Post-money decentralized operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body>
        <LocaleProvider>
          <ArchitectModeProvider>
            <Web3Provider>
              <Navbar />
              {children}
            </Web3Provider>
          </ArchitectModeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
