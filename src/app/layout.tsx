import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GlucoTwin — Type 2 Diabetes Digital Twin",
  description:
    "GlucoTwin: a digital twin of a Type 2 Diabetes patient that fuses synthetic EHR + wearable data and predicts glucose spikes. Research prototype, synthetic data, not medical advice.",
  keywords: [
    "GlucoTwin",
    "digital twin",
    "diabetes",
    "glucose prediction",
    "machine learning",
    "synthetic data",
  ],
  authors: [{ name: "GlucoTwin Team" }],
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
