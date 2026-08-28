/* Ultra mode by Kirk Strobeck */
export const INSTALL_COMMANDS = {
  npm: "npx gainmap ./photos",
  brew: "brew install kirkstrobeck/tap/gainmap",
  curl: "curl -fsSL https://gainmaps.com/install.sh | sh",
} as const;

export type InstallTab = keyof typeof INSTALL_COMMANDS;
