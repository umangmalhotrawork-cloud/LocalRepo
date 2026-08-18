import type { Metadata } from "next";
import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";

export const metadata: Metadata = {
  title: "NEXUS: Autonomous Software Engineering",
  description:
    "A local-first AI software engineering environment that understands your codebase, plans engineering work, performs controlled code changes, verifies behavior, and preserves context across sessions.",
  keywords: [
    "NEXUS",
    "Autonomous Software Engineering",
    "Local-First AI IDE",
    "Behavioral Dependency Graph",
    "AI Patch Firewall",
    "Behavior Verification",
    "Continuum Session Memory",
    "Safe Remove Surgery",
  ],
  authors: [{ name: "NEXUS Core Team" }],
  openGraph: {
    title: "NEXUS: Autonomous Software Engineering",
    description:
      "Local-first AI software engineering environment. Understands codebases, plans changes, verifies behavior, and preserves session context.",
    type: "website",
    siteName: "NEXUS",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS: Autonomous Software Engineering",
    description:
      "A local-first AI software engineering environment that understands your codebase, plans engineering work, performs controlled code changes, and verifies behavior.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "NEXUS",
    "operatingSystem": "macOS, Windows, Linux",
    "applicationCategory": "DeveloperApplication",
    "description": "Local-first Autonomous AI Software Engineering Environment.",
    "license": "https://opensource.org/licenses/MIT",
  };

  return (
    <html lang="en" className="dark scroll-smooth bg-[#050505]">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-[#050505] text-white antialiased min-h-screen">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
