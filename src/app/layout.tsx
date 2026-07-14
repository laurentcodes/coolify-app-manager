import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coolify Manager",
  description: "A private console for Coolify applications and deployments.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
