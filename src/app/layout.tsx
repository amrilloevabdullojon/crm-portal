import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DMED Portal",
  description: "Client portal and manager workspace for DMED onboarding",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
