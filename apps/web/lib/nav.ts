export type NavLink = {
  readonly href: string;
  readonly label: string;
};

/** Primary nav links — appear in the site header and footer primary group. */
export const PRIMARY_NAV_LINKS: readonly NavLink[] = [
  { href: "/convert",    label: "Convert"    },
  { href: "/photos",     label: "Gallery"    },
  { href: "/docs",       label: "Docs"       },
  { href: "/developers", label: "Developers" },
  { href: "/community",  label: "Community"  },
];

/** Secondary footer links — explore and utility pages. */
export const FOOTER_SECONDARY_LINKS: readonly NavLink[] = [
  { href: "/logos",                  label: "Logos"         },
  { href: "/text",                   label: "Text"          },
  { href: "/appearance",             label: "Appearance"    },
  { href: "/convert/how-it-works",   label: "How it works"  },
  { href: "/about",                  label: "About"         },
  { href: "/contact",                label: "Contact"       },
  { href: "/privacy",                label: "Privacy"       },
];

/** All footer links: primary nav + secondary pages. */
export const FOOTER_LINKS: readonly NavLink[] = [
  ...PRIMARY_NAV_LINKS,
  ...FOOTER_SECONDARY_LINKS,
];
