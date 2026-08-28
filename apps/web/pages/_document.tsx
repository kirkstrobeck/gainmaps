// Barebones _document for Next.js 15.5.22 Pages Router fallback pages.
// All next/document components (Html, Head, Main, NextScript) call useHtmlContext()
// which fails in the SSG worker due to a React instance mismatch between
// pages.runtime.prod.js and the app's webpack bundle. Using plain HTML here.
export default function Document() {
  return (
    <html lang="en">
      <head />
      <body />
    </html>
  );
}
