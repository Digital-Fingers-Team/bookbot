import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { AppShell } from "@/components/navigation";
import { QueryProvider } from "@/components/query-provider";
import { LanguageProvider } from "@/lib/i18n";

const cairo = Cairo({ subsets: ["arabic", "latin"], display: "swap" });

export const metadata: Metadata = {
  title: "منصة المعرفة — المنظمة العربية للتنمية الإدارية",
  description: "نظام معرفي يجيب عن أسئلتك استنادًا إلى كتبك المرفوعة مع توثيق المصادر."
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

const langScript = `
  try {
    const saved = localStorage.getItem("bookbot-lang") || "ar";
    document.documentElement.lang = saved;
    document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
  } catch {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.className} min-h-screen antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: langScript }} />
        <LanguageProvider>
          <AuthProvider>
            <QueryProvider>
              <AppShell>{children}</AppShell>
            </QueryProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
