# Public marketing refresh

The public home and six `/recursos/:featureId` pages use a scoped `mkt-` stylesheet. Operational dashboard components, authentication, database and financial rules remain unchanged.

## Design

Black and muted gold, self-hosted Space Grotesk and DM Sans (OFL licenses included), mobile-first original photographic background, CSS fade into the page, responsive typography, a compact fixed header, linked resource rails driven by scrolling, keyboard-accessible feature tabs, six illustrative demos, pricing and FAQs. Illustrations use explicitly fictional data; they are not screenshots of customer records.

## Verified product sources

- Agenda and reserved duration: `src/pages/dashboard/professional/pet/PetAgenda.tsx`, `edit_booking_reservation`.
- Deferred and partial payments: `src/components/BookingReceivables.tsx`, `complete_booking_payment` and `receive_booking_payment`.
- Packages: `src/pages/dashboard/tabs/Packages.tsx`, `sell_customer_package`, `consume_package_session`.
- Authentication and registration CTA: existing `src/pages/dashboard/BusinessAuth.tsx`.
- Owner/staff separation: existing dashboard role checks and RPC authorization.
- Price and trial: retained existing public offer of R$60/month/establishment, 30 days without a card.

## Original image

Built-in image generation; `public/assets/marketing/onefind-studio-mobile.webp` is the selected 1024×1536 image, encoded as WebP. The earlier animal image is not shipped.

Prompt: Create a new portrait 1024x1536 premium photorealistic website background for onefind, in black and muted gold. No animals or people. Show only an empty contemporary pet grooming studio: matte charcoal walls, dark stone, brushed brass details, golden ambient lighting, black wash basin and brass faucet, folded charcoal towels and uncluttered furniture. Upper 55% should be calm dark architectural negative space for white typography. Studio details in the lower middle third. Natural architectural photographic texture, not a mockup; no words, logos or UI. Bottom 25% fades smoothly to near-black #111214, merging with a dark website.

## Verification

`tests/e2e/marketing-story.spec.ts` checks the home, six feature pages, tab mouse and keyboard navigation, mobile menu, FAQ, image/font loading, canonical URLs, reduced motion, scroll-only rail movement, login and signup destinations at 320, 375, 390, 430 and 1440 px. Uses only read-only public interactions; does not create accounts or mutate business data.

Navigation clarification: the header routes existing users to /painel; the menu separates panel entry from public information. The original HeroTitle typing sequence is reused.

## November mobile polish

The hero typing sequence now holds each phrase for 2.4 seconds and types at 52 ms per character. The photographic hero covers 100svh and ends with a masked glass fade. Rails remain scroll-driven with a short transform transition. The redundant menu panel entry was removed; logged-in account navigation is preserved. An official Google button reuses completeGoogleCredentialLogin with the existing PET onboarding. The live provider credential exchange needs an actual Google account and is not asserted by viewport tests.

FAQ, privacy and MyBookings share the scoped marketing shell. Legal text is preserved. ProfessionalShell no longer repeats the shop/section breadcrumb. The day picker keeps fixed 44px buttons around a constrained date field.
