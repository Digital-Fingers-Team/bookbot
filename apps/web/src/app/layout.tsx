import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Navigation } from "@/components/navigation";

export const metadata: Metadata = {
  title: "BookBot",
  description: "Strict RAG knowledge system for uploaded books."
};

const themeScript = `
  try {
    const saved = localStorage.getItem("bookbot-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", saved ? saved === "dark" : prefersDark);
  } catch {
    document.documentElement.classList.remove("dark");
  }
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AuthProvider>
          <Navigation />
          <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
