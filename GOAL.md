# Gainmaps Goal Checklist

Some original notes were already implemented before this file was cleaned up. Checked items are only marked complete when the current repository has direct evidence for them.

## Launch And Sharing

- [x] Replace the old "PH" treatment with the Product Hunt logo.
- [x] Use the official Product Hunt SVG mark geometry.
- [x] Put the Product Hunt logo, "Upvote", and an up arrow in the same pill.
- [x] Set the Product Hunt link title and accessible name to "Upvote on Product Hunt".
- [x] Point Product Hunt links at `https://www.producthunt.com/products/gain-maps-stunning-colors-for-ui`.
- [x] Use the Product Hunt embed widget on the lower homepage implementation.
- [x] Keep Share, Copy link, and Upvote controls visually consistent in size.
- [x] Add share/copy/Product Hunt controls to the persistent nav/header area.
- [x] Track Product Hunt clicks in PostHog.

## PostHog Instrumentation

- [x] Fix PostHog client configuration so `NEXT_PUBLIC_POSTHOG_*` values are available in production.
- [x] Proxy PostHog traffic through `/ingest`.
- [x] Enable automatic pageview/pageleave tracking.
- [x] Instrument homepage converter file selection.
- [x] Instrument converter file add/reject events.
- [x] Instrument service worker readiness and worker errors.
- [x] Instrument web worker job start, completion, and failure.
- [x] Instrument download starts from auto-download, selected-button, and queue-row paths.
- [x] Instrument gain/headroom changes.
- [x] Instrument auto-download changes.
- [x] Instrument queue clearing and redo actions.
- [x] Instrument install method selection for npm, brew, and curl.
- [x] Instrument command/prompt/skill copy actions.
- [x] Instrument share and copy-link actions.
- [x] Instrument display-check open, answer, and dismissal.
- [x] Avoid sending filenames or file contents to PostHog.

## Repository Size And Assets

- [x] Squash the repository history into one root commit.
- [x] Move high-resolution photo source assets out of the repository and document Supabase static storage.
- [x] Keep photo catalog assets hosted under a Supabase tenant path.
- [x] Document that photo source files are not stored in the repository.
- [ ] Verify GitHub-reported repository size after remote history cleanup and garbage collection.
- [ ] Reduce the full local checkout footprint where possible without counting dependency/build caches.

## Homepage Information Architecture

- [x] Add a top-level Developers nav link.
- [x] Hide unfinished light/dark and SDR/Ultra controls without deleting the underlying code.
- [x] Make the top call to action say "Convert your image".
- [x] Make the image converter explain that it is free, instant, private, and returns the same file format.
- [x] Add a link from the terminal/install area to developer documentation.
- [x] Add a link from the prompt/skill area to developer documentation.
- [x] Move the "Every platform named it differently" material off the homepage and into docs/reference content.
- [x] Add a lower homepage developer section with CLI, Docker, testing, and automation positioning.
- [x] Keep the homepage Product Hunt area near the lower page.
- [ ] Further refine homepage visual hierarchy after launch based on real screenshots.

## Logo And Photo Galleries

- [x] Put the "100 brand logos" heading above the logo examples.
- [x] Replace the large browse-all buttons with compact browse-all links.
- [x] Keep the three-logo and three-photo homepage sections visually aligned.
- [x] Use Instagram, Lego, and American Express as homepage logo examples.
- [x] Preserve the cropping/scaling direction for logo examples.
- [x] Replace black/dark logo examples with bright or white logo variants where needed.
- [x] Ensure homepage/gallery photo examples include prominent light or white areas.
- [x] Use comparison sliders for homepage photo teasers and gallery photos.
- [x] Make slider cuts instant, hard, and without a visible border line.
- [x] Allow grabbing the image comparison bar along the full line, not only at the thumb.
- [x] Preload the next rotating homepage photo before reveal.
- [x] Run the rotating homepage photo only while it is in the viewport.
- [x] Add an SVG circle countdown/loading bar without numbers for the rotating photo.
- [ ] Continue auditing individual logo source files for malformed or visually broken SVGs.

## Ultra Text

- [x] Keep Ultra Text as an accessible mask implementation with real selectable text in the DOM.
- [x] Use canvas/WebGPU for the HDR/Ultra rendering rather than CSS-only color treatment.
- [x] Use a 0.5 px inset for the brightest inner white mask.
- [x] Use a 0.3 px blur on the inner mask only.
- [x] Keep the outer edge sharp while reducing jagged/cracked inner edges.
- [x] Put the brightest white layer above the foundation layer to prevent stroke artifacts from showing through.
- [x] Use the foundation layer at 75% of the specified headroom.
- [x] Document that the implementation is more than a mask: layer order, foundation headroom, inner inset, and inner blur are required to avoid crispy edges.
- [x] Make the `Gainmaps` header use Ultra treatment.
- [x] Make major page headings use Ultra treatment when Ultra is enabled.
- [x] Ensure the home page Ultra Text implementation uses the latest shared component.
- [x] On `/text`, keep the plain SDR side as basic normal text without masking or Ultra treatment.
- [x] Add clear `/text` links back to developers and implementation details.
- [x] Add one-click copy for the Ultra Text skill link on `/text`.
- [x] Add one-click copy for the Ultra Text prompt on `/text`.
- [x] Reuse the same Ultra skill/prompt module across the site.
- [x] Note in developer docs that the skill is recommended because it can be updated over time.
- [x] Update the reusable skill and prompt to stay aligned with the current implementation.
- [x] Prohibit animation on Ultra text.

## Display Check

- [x] Add a blocking display-check modal with a bright square and hidden Ultra symbol.
- [x] Change the response labels to "Yes" and "No".
- [x] When "No" is selected, show three square photos that help demonstrate the effect.
- [x] Explain that it is hard to show what someone cannot see, so photos help demonstrate the effect.
- [x] Move display-check dismissal state to `localStorage`.
- [x] Make the confirmation/dismissal text bolder and easier to read.
- [x] Keep a manual Display check control in the nav.

## Converter Behavior

- [x] Always write back the same file type from the web converter.
- [x] Remove inaccurate text claiming the app can detect display headroom or exact nits.
- [x] Replace "The same file, two renderers" with language explaining that a gain map was added.
- [x] Ensure shown Ultra effects use maximum gain map settings where intended.
- [x] Ensure comparison SDR/Ultra examples are gain-map vs not-gain-map only.
- [ ] Add a GitHub issue for changing/exporting file type from the web converter.
- [ ] Continue verifying identical displayed resolution on high pixel density displays.

## Developers, CLI, Brew, Curl, Skill

- [x] Add expanded developer documentation for CLI, skills, and API usage.
- [x] Add stable anchors in developer documentation.
- [x] Add CLI changelog links from developer docs.
- [x] Add skill changelog links from developer docs.
- [x] Keep the skill agent-agnostic rather than Claude-specific.
- [x] Provide both Copy skill and Copy prompt actions.
- [x] Align npm, brew, and curl install surfaces around the same CLI source.
- [x] Add Docker-based CLI e2e coverage fixtures/checksum structure.
- [ ] Finish release automation for npm, brew, and curl distribution updates.
- [ ] Add drift-prevention tests proving the skill and prompt remain aligned.

## Community

- [x] Hide the unfinished Community page from navigation and sitemap for launch.
- [ ] Build the GitHub-backed Community page later.
- [ ] Remove or replace Giscus.
- [ ] Cache GitHub issues/discussions server-side.
- [ ] Show discussions first, respect pinned discussions, and paginate lists at 10 items per page.
- [ ] Link community items to GitHub for help and participation.
- [ ] Add a tasteful "PRs welcome" developer/community note.

## Quality Gates And CI

- [x] Keep the current full web test suite passing.
- [x] Keep the production Next build passing.
- [x] Keep TypeScript typecheck passing.
- [ ] Reach and enforce 100% test coverage across the whole repo.
- [ ] Add a GitHub Action for 100% test coverage of the site.
- [ ] Add a GitHub Action for CLI/package coverage.
- [ ] Add a GitHub Action that runs the npm, brew, and curl Docker CLI checks.
- [ ] Add a GitHub Action for 100% Lighthouse desktop and mobile scores.
- [ ] Add a GitHub Action for SEO scoring.
- [ ] Add `npx is-agentic` to CI and enforce 100% score.
- [ ] Establish visible PR reporting for coverage and quality scores.
- [ ] Verify sustained 60fps site performance.

## Production

- [x] Push the current shipped state to production through the main branch deploy path.
- [x] Confirm production bundles include the latest PostHog instrumentation.
- [ ] Re-check production screenshots across key viewport widths before final launch announcement.
