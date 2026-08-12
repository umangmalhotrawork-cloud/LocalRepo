import type { Metadata } from "next";
import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";

export const metadata: Metadata = {
  title: "Echo Nullity: Causal Code Tomography Engine",
  description:
    "Detect semantically vacuous code in AI-generated software. Visualizes Ghost Code, computes Causal Luminance, maps Semantic Tension, and safely removes redundant behavior.",
  keywords: [
    "Echo Nullity",
    "Causal Luminance",
    "Ghost Code",
    "Semantic Tension Mapping",
    "Safe Remove",
    "Code Tomography",
    "Tree-sitter",
    "Rust static analysis",
    "AI code bloat",
    "PLDI 2026",
  ],
  authors: [{ name: "Echo Nullity Research Group" }],
  openGraph: {
    title: "Echo Nullity: Causal Code Tomography Engine",
    description:
      "Find code that runs, passes tests, and still means nothing. A local-first causal measurement instrument for software.",
    type: "website",
    siteName: "Echo Nullity",
  },
  twitter: {
    card: "summary_large_image",
    title: "Echo Nullity: Causal Code Tomography Engine",
    description:
      "Detect semantically vacuous code in AI-generated software with verified Safe Remove surgery.",
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
    "name": "Echo Nullity",
    "operatingSystem": "Linux, macOS, Windows",
    "applicationCategory": "DeveloperApplication",
    "description": "Local-first Causal Code Tomography Engine for AI-generated software.",
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
