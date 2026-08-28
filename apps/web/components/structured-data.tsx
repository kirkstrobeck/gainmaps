export function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.gainmaps.com/#organization",
        name: "Gainmaps",
        url: "https://www.gainmaps.com",
        contactPoint: {
          "@type": "ContactPoint",
          email: "kirk@strobeck.com",
          contactType: "customer support",
          url: "https://www.gainmaps.com/contact",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.gainmaps.com/#cli",
        name: "gainmap",
        applicationCategory: "MultimediaApplication",
        operatingSystem: "macOS, Linux, Windows",
        description: "CLI tool to batch-encode HDR gain map JPEG images",
        url: "https://www.gainmaps.com/docs",
        publisher: { "@id": "https://www.gainmaps.com/#organization" },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
