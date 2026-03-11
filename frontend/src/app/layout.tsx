import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Web3Provider } from "@/components/Web3Provider";
import { LocaleProvider } from "@/lib/i18n/context";
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
          <Web3Provider>
            <header className="border-border/50 border-b bg-background/95 px-4 py-3 shadow-soft">
              <Link
                href="/"
                className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
                aria-label="Mana OS — Home"
              >
                <Image
                  src="/logo.png"
                  alt=""
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain shrink-0"
                />
                <span className="text-xl font-semibold text-primary tracking-tight">
                  Mana OS
                </span>
              </Link>
            </header>
            {children}
          </Web3Provider>
        </LocaleProvider>
      </body>
    </html>
  );
}
