import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE } from "@/domain/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MicroTaskManager",
  description: "Gerenciador minimalista de tarefas pessoais",
};

/**
 * Fallback localStorage (RF-6): roda antes do paint quando NÃO há cookie.
 * Aplica o tema salvo e regrava o cookie para o próximo SSR resolver no servidor.
 */
const themeFallbackScript = `(function(){try{if(document.cookie.indexOf('${THEME_COOKIE}=')===-1){var t=localStorage.getItem('${THEME_COOKIE}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.cookie='${THEME_COOKIE}='+t+'; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax'}}}catch(e){}})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = raw === undefined ? undefined : parseTheme(raw);

  return (
    <html
      lang="pt-BR"
      data-theme={theme}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeFallbackScript }} />
        {children}
      </body>
    </html>
  );
}
