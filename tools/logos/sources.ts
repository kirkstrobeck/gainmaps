/**
 * Seed list for the /logos showcase: the 100 most recognizable global brands,
 * in Interbrand Best Global Brands 2025 order.
 *
 * Interbrand ranks brands, not companies — a brand only qualifies if it is
 * recognized worldwide, so this is a recognition list rather than a market-cap
 * one. Entries are the brand Interbrand names, which is often not the listed
 * parent: Google rather than Alphabet, Facebook and Instagram rather than Meta,
 * Coca-Cola rather than The Coca-Cola Company.
 *
 * `svglTitle` is an exact api.svgl.app title. When present the pipeline takes
 * the svgl asset first, because those are hand-curated brand SVGs.
 *
 * `wikipedia` is an en.wikipedia article title, resolved through redirects to a
 * Wikidata item and then to its P154 (logo image) file.
 *
 * `commonsFile` overrides P154 when Wikidata has no SVG, or points at an
 * outdated logo. It is a file name without the `File:` prefix, resolved through
 * en.wikipedia's Special:FilePath — which serves Commons files and the
 * enwiki-local uploads (non-free brand marks) that Commons does not host.
 *
 * `ticker` is optional and left unset here: most of these are product or
 * private brands (Instagram, Louis Vuitton, Pampers, Chanel) with no ticker of
 * their own, and a brand's parent ticker would be a different entity.
 *
 * Rank 101 is not an Interbrand rank. Monster (#70) publishes no vector logo
 * anywhere the pipeline can reach — Wikimedia Commons, en.wikipedia and svgl
 * all carry raster art only — so its seed stays in place for the record and
 * American Express, #27 in Best Global Brands 2024, fills the hundredth tile.
 * Similarly Danone (#85) has only a raster PNG; rank 102 Starbucks fills that slot.
 */
export type LogoSeed = {
  readonly rank: number;
  readonly name: string;
  readonly slug: string;
  readonly wikipedia: string;
  /** Stock ticker, when the brand is itself a listed company. */
  readonly ticker?: string;
  readonly svglTitle?: string;
  readonly commonsFile?: string;
};

export const LOGO_SEEDS: readonly LogoSeed[] = [
  { rank: 1, name: "Apple", slug: "apple", wikipedia: "Apple Inc.", svglTitle: "Apple" },
  { rank: 2, name: "Microsoft", slug: "microsoft", wikipedia: "Microsoft", svglTitle: "Microsoft" },
  { rank: 3, name: "Amazon", slug: "amazon", wikipedia: "Amazon (company)", svglTitle: "Amazon" },
  { rank: 4, name: "Google", slug: "google", wikipedia: "Google", svglTitle: "Google" },
  { rank: 5, name: "Samsung", slug: "samsung", wikipedia: "Samsung", svglTitle: "Samsung" },
  { rank: 6, name: "Toyota", slug: "toyota", wikipedia: "Toyota", svglTitle: "Toyota" },
  { rank: 7, name: "Coca-Cola", slug: "coca-cola", wikipedia: "Coca-Cola" },
  { rank: 8, name: "Instagram", slug: "instagram", wikipedia: "Instagram", svglTitle: "Instagram" },
  { rank: 9, name: "Louis Vuitton", slug: "louis-vuitton", wikipedia: "Louis Vuitton" },
  { rank: 10, name: "Tesla", slug: "tesla", wikipedia: "Tesla, Inc.", svglTitle: "Tesla" },
  { rank: 11, name: "Hermès", slug: "hermes", wikipedia: "Hermès", commonsFile: "Hermes_wordmark.svg" },
  { rank: 12, name: "Nike", slug: "nike", wikipedia: "Nike, Inc.", svglTitle: "Nike" },
  { rank: 13, name: "YouTube", slug: "youtube", wikipedia: "YouTube", svglTitle: "YouTube" },
  { rank: 14, name: "BMW", slug: "bmw", wikipedia: "BMW" },
  { rank: 15, name: "Mercedes-Benz", slug: "mercedes-benz", wikipedia: "Mercedes-Benz", svglTitle: "Mercedes" },
  { rank: 16, name: "Disney", slug: "disney", wikipedia: "The Walt Disney Company", svglTitle: "Disney" },
  { rank: 17, name: "Chanel", slug: "chanel", wikipedia: "Chanel" },
  { rank: 18, name: "SAP", slug: "sap", wikipedia: "SAP" },
  { rank: 19, name: "Facebook", slug: "facebook", wikipedia: "Facebook", svglTitle: "Facebook" },
  { rank: 20, name: "Honda", slug: "honda", wikipedia: "Honda", svglTitle: "Honda" },
  { rank: 21, name: "Gucci", slug: "gucci", wikipedia: "Gucci" },
  { rank: 22, name: "Porsche", slug: "porsche", wikipedia: "Porsche", svglTitle: "Porsche" },
  { rank: 23, name: "Accenture", slug: "accenture", wikipedia: "Accenture", svglTitle: "Accenture" },
  { rank: 24, name: "Zara", slug: "zara", wikipedia: "Zara (retailer)", svglTitle: "Zara" },
  { rank: 25, name: "Spotify", slug: "spotify", wikipedia: "Spotify", svglTitle: "Spotify" },
  { rank: 26, name: "IKEA", slug: "ikea", wikipedia: "IKEA", svglTitle: "IKEA" },
  { rank: 27, name: "Nescafé", slug: "nescafe", wikipedia: "Nescafé" },
  { rank: 28, name: "ALDI", slug: "aldi", wikipedia: "Aldi", svglTitle: "ALDI" },
  { rank: 29, name: "LinkedIn", slug: "linkedin", wikipedia: "LinkedIn", svglTitle: "LinkedIn" },
  { rank: 30, name: "J.P. Morgan", slug: "jpmorgan", wikipedia: "JPMorgan Chase", svglTitle: "JPMorgan Chase" },
  { rank: 31, name: "Prada", slug: "prada", wikipedia: "Prada" },
  { rank: 32, name: "Goldman Sachs", slug: "goldman-sachs", wikipedia: "Goldman Sachs" },
  { rank: 33, name: "Hyundai", slug: "hyundai", wikipedia: "Hyundai Motor Company", svglTitle: "Hyundai" },
  { rank: 34, name: "Mastercard", slug: "mastercard", wikipedia: "Mastercard", svglTitle: "Mastercard" },
  { rank: 35, name: "Pampers", slug: "pampers", wikipedia: "Pampers", commonsFile: "Pampers_logo.svg" },
  { rank: 36, name: "Kia", slug: "kia", wikipedia: "Kia Corporation", svglTitle: "Kia" },
  { rank: 37, name: "Red Bull", slug: "red-bull", wikipedia: "Red Bull" },
  { rank: 38, name: "Pepsi", slug: "pepsi", wikipedia: "Pepsi" },
  { rank: 39, name: "Netflix", slug: "netflix", wikipedia: "Netflix", svglTitle: "Netflix" },
  { rank: 40, name: "Shell", slug: "shell", wikipedia: "Shell plc" },
  { rank: 41, name: "Volkswagen", slug: "volkswagen", wikipedia: "Volkswagen", svglTitle: "Volkswagen" },
  { rank: 42, name: "Salesforce", slug: "salesforce", wikipedia: "Salesforce", svglTitle: "Salesforce" },
  { rank: 43, name: "AXA", slug: "axa", wikipedia: "AXA" },
  { rank: 44, name: "L'Oréal", slug: "loreal", wikipedia: "L'Oréal" },
  { rank: 45, name: "Gillette", slug: "gillette", wikipedia: "Gillette (brand)" },
  { rank: 46, name: "Huawei", slug: "huawei", wikipedia: "Huawei" },
  { rank: 47, name: "UNIQLO", slug: "uniqlo", wikipedia: "Uniqlo" },
  { rank: 48, name: "Nespresso", slug: "nespresso", wikipedia: "Nespresso" },
  { rank: 49, name: "Audi", slug: "audi", wikipedia: "Audi", svglTitle: "Audi" },
  { rank: 50, name: "LEGO", slug: "lego", wikipedia: "Lego" },
  { rank: 51, name: "Adidas", slug: "adidas", wikipedia: "Adidas", svglTitle: "Adidas" },
  { rank: 52, name: "Cartier", slug: "cartier", wikipedia: "Cartier (jewelry)", commonsFile: "Cartier_logo.svg" },
  { rank: 53, name: "Nintendo", slug: "nintendo", wikipedia: "Nintendo" },
  { rank: 54, name: "Allianz", slug: "allianz", wikipedia: "Allianz" },
  { rank: 55, name: "Range Rover", slug: "range-rover", wikipedia: "Range Rover", svglTitle: "Land Rover" },
  { rank: 56, name: "PayPal", slug: "paypal", wikipedia: "PayPal", svglTitle: "PayPal" },
  { rank: 57, name: "Rolex", slug: "rolex", wikipedia: "Rolex", commonsFile: "Rolex_wordmark_logo.svg" },
  { rank: 58, name: "Zoom", slug: "zoom", wikipedia: "Zoom Video Communications", svglTitle: "Zoom" },
  { rank: 59, name: "Visa", slug: "visa", wikipedia: "Visa Inc.", svglTitle: "Visa" },
  { rank: 60, name: "Tiffany & Co.", slug: "tiffany", wikipedia: "Tiffany & Co." },
  { rank: 61, name: "Caterpillar", slug: "caterpillar", wikipedia: "Caterpillar Inc." },
  { rank: 62, name: "Siemens", slug: "siemens", wikipedia: "Siemens", svglTitle: "Siemens" },
  { rank: 63, name: "Dior", slug: "dior", wikipedia: "Christian Dior SE" },
  { rank: 64, name: "WeChat", slug: "wechat", wikipedia: "WeChat", commonsFile: "WeChat_logo.svg" },
  { rank: 65, name: "Lexus", slug: "lexus", wikipedia: "Lexus", svglTitle: "Lexus" },
  { rank: 66, name: "Budweiser", slug: "budweiser", wikipedia: "Budweiser", commonsFile: "Budweiser Anheuser-Busch logo.svg" },
  { rank: 67, name: "Lamborghini", slug: "lamborghini", wikipedia: "Lamborghini", svglTitle: "Lamborghini" },
  { rank: 68, name: "Renault", slug: "renault", wikipedia: "Renault", svglTitle: "Renault" },
  { rank: 69, name: "Puma", slug: "puma", wikipedia: "Puma (brand)", svglTitle: "Puma" },
  // No vector logo on Commons, en.wikipedia or svgl — the article carries a
  // .webp raster only. Seeded for the record; the build reports it as a skip.
  { rank: 70, name: "Monster", slug: "monster", wikipedia: "Monster Energy" },
  { rank: 71, name: "Burberry", slug: "burberry", wikipedia: "Burberry" },
  { rank: 72, name: "HSBC", slug: "hsbc", wikipedia: "HSBC" },
  { rank: 73, name: "3M", slug: "3m", wikipedia: "3M" },
  { rank: 74, name: "Philips", slug: "philips", wikipedia: "Philips" },
  { rank: 75, name: "Ferrari", slug: "ferrari", wikipedia: "Ferrari", svglTitle: "Ferrari" },
  { rank: 76, name: "Colgate", slug: "colgate", wikipedia: "Colgate (toothpaste)" },
  { rank: 77, name: "Hennessy", slug: "hennessy", wikipedia: "Hennessy", commonsFile: "Logo_hennessy.svg" },
  { rank: 78, name: "Kellogg's", slug: "kelloggs", wikipedia: "Kellogg's" },
  { rank: 79, name: "Jeep", slug: "jeep", wikipedia: "Jeep" },
  { rank: 80, name: "FedEx", slug: "fedex", wikipedia: "FedEx", svglTitle: "FedEx" },
  { rank: 81, name: "Xiaomi", slug: "xiaomi", wikipedia: "Xiaomi" },
  { rank: 82, name: "Panasonic", slug: "panasonic", wikipedia: "Panasonic" },
  { rank: 83, name: "Ralph Lauren", slug: "ralph-lauren", wikipedia: "Ralph Lauren Corporation" },
  { rank: 84, name: "Jack Daniel's", slug: "jack-daniels", wikipedia: "Jack Daniel's", commonsFile: "Jack_Daniels_Logo.svg" },
  { rank: 85, name: "Danone", slug: "danone", wikipedia: "Danone" },
  { rank: 86, name: "Corona", slug: "corona", wikipedia: "Corona (beer)" },
  { rank: 87, name: "John Deere", slug: "john-deere", wikipedia: "John Deere", commonsFile: "John_Deere_Logo_–_Flat_2_Color.svg" },
  { rank: 88, name: "DHL", slug: "dhl", wikipedia: "DHL", svglTitle: "DHL" },
  { rank: 89, name: "Henkel", slug: "henkel", wikipedia: "Henkel" },
  { rank: 90, name: "Harley-Davidson", slug: "harley-davidson", wikipedia: "Harley-Davidson" },
  { rank: 91, name: "Nestlé", slug: "nestle", wikipedia: "Nestlé" },
  { rank: 92, name: "Heineken", slug: "heineken", wikipedia: "Heineken", svglTitle: "Heineken" },
  { rank: 93, name: "Xerox", slug: "xerox", wikipedia: "Xerox" },
  { rank: 94, name: "Adobe", slug: "adobe", wikipedia: "Adobe Inc.", svglTitle: "Adobe" },
  { rank: 95, name: "Subaru", slug: "subaru", wikipedia: "Subaru" },
  { rank: 96, name: "H&M", slug: "h-and-m", wikipedia: "H&M", svglTitle: "H&M" },
  { rank: 97, name: "Morgan Stanley", slug: "morgan-stanley", wikipedia: "Morgan Stanley" },
  { rank: 98, name: "Duracell", slug: "duracell", wikipedia: "Duracell" },
  { rank: 99, name: "Shopify", slug: "shopify", wikipedia: "Shopify", svglTitle: "Shopify" },
  { rank: 100, name: "UPS", slug: "ups", wikipedia: "United Parcel Service" },
  // Stands in for Monster; see the note at the top of this file.
  { rank: 101, name: "American Express", slug: "american-express", wikipedia: "American Express" },
  // Stands in for Danone (#85); Danone publishes only a raster PNG logo on Wikimedia Commons.
  // Starbucks is globally recognized and ships a first-party SVG on Commons.
  { rank: 102, name: "Starbucks", slug: "starbucks", wikipedia: "Starbucks", commonsFile: "Starbucks_Corporation_Logo_2011.svg" },
];

