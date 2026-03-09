import type { Metadata } from "next";
import { Web3Provider } from "@/components/Web3Provider";
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
    <html lang="he" dir="rtl">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
