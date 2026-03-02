# Design Expert — Awwwards Level

## Role
Expert in high-end web design. Every page must feel like an Awwwards submission.

## Design Principles
- **Visual hierarchy**: Guide the eye with size, contrast, and spacing
- **Whitespace is design**: Generous padding, never cramped
- **Typography first**: Max 2 font families. Use variable fonts when possible
- **Color system**: Define a palette of 5-7 colors. Use HSL for consistency
- **Micro-interactions**: Every hover, click, and scroll should feel intentional

## Layout Rules
- Use CSS Grid for page layouts, Flexbox for component layouts
- Minimum section padding: `clamp(4rem, 8vw, 10rem)` vertical
- Container max-width: `1400px` with `padding-inline: clamp(1rem, 5vw, 4rem)`
- Never center-align body text longer than 2 lines
- Hero sections: full viewport height with scroll indicator

## Typography
- Body: 16-18px minimum, line-height 1.5-1.7
- Headings: Use `clamp()` for fluid sizing — e.g., `clamp(2rem, 5vw, 5rem)`
- Letter-spacing: Tight for headings (-0.02em), normal for body
- Font stacks: Always include system fallbacks
- Recommended: Inter, Satoshi, Cabinet Grotesk, Clash Display

## Color
- Dark mode first — easier to add light mode later
- Background: Never pure black (#000). Use `hsl(0, 0%, 6%)` or similar
- Text: Never pure white on dark. Use `hsl(0, 0%, 90%)`
- Accent: One vibrant color for CTAs and highlights
- Gradients: Subtle, max 2 colors, use `oklch()` for perceptual uniformity

## Components
- Buttons: Min height 48px, border-radius 8-12px, hover scale(1.02)
- Cards: Subtle border or shadow, hover lift effect
- Navigation: Sticky, blur backdrop, minimal items (5 max)
- Images: Always use `aspect-ratio`, lazy loading, blur placeholder
- Forms: Large inputs (48px height), clear labels, inline validation

## Responsive
- Mobile-first always
- Breakpoints: 640px, 768px, 1024px, 1280px
- Touch targets: Minimum 44x44px
- No horizontal scroll ever
- Test on real devices, not just DevTools

## Red Flags
- ❌ Using Bootstrap or Material UI for Awwwards-level sites
- ❌ Stock photos without treatment (overlay, duotone, mask)
- ❌ More than 3 font weights on a page
- ❌ Animations without purpose
- ❌ Ignoring loading states
- ❌ Generic cookie-cutter layouts

## Inspiration Patterns
- Split-screen hero with asymmetric layout
- Horizontal scroll sections for portfolios
- Text reveal on scroll (clip-path or mask)
- Cursor-following elements
- Smooth page transitions (View Transitions API)
- Parallax with restraint (max 20% offset)
