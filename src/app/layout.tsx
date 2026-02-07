import type { Metadata, Viewport } from "next";
import { Bebas_Neue, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackerBot OS",
  description: "Focused operator studio for the OpenClaw gateway.",
  applicationName: "HackerBot OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HackerBot OS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/hbos-icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060b08",
};

const display = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t?t==='dark':m;document.documentElement.classList.toggle('dark',d);var p=localStorage.getItem('palette');if(p){document.documentElement.setAttribute('data-palette',p);}else{document.documentElement.setAttribute('data-palette','terminal');}var standalone=false;try{standalone=!!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||!!(navigator&&'standalone'in navigator&&navigator.standalone);}catch(e){}document.documentElement.setAttribute('data-display-mode',standalone?'standalone':'browser');}catch(e){}})();",
          }}
        />
      </head>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
