---
name: design-taste-anti-slop
description: Forbidden patterns and anti-cliches to guarantee premium, non-generic AI design output.
---

# Design Taste: Anti-Slop (Forbidden Patterns)

To guarantee a premium output, you MUST strictly avoid these common AI design signatures unless explicitly requested:

## Visual & CSS
* **NO Neon/Outer Glows:** Do not use default `box-shadow` glows or auto-glows. Use inner borders or subtle tinted shadows.
* **NO Pure Black:** Never use `#000000`. Use Off-Black, Zinc-950, or Charcoal.
* **NO Oversaturated Accents:** Desaturate accents to blend elegantly with neutrals.
* **NO Excessive Gradient Text:** Do not use text-fill gradients for large headers.
* **NO Custom Mouse Cursors:** They are outdated and ruin performance/accessibility.

## Typography
* **NO Inter Font:** Banned. Use `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
* **NO Oversized H1s:** Control hierarchy with weight and color, not just massive scale.
* **Serif Constraints:** Use Serif fonts ONLY for creative/editorial designs. **NEVER** use Serif on clean Dashboards.

## Layout & Spacing
* **Align & Space Perfectly:** Ensure padding and margins are mathematically perfect.
* **NO 3-Column Card Layouts:** The generic "3 equal cards horizontally" feature row is BANNED. Use 2-column Zig-Zag, asymmetric grid, or horizontal scrolling.

## Content & Data (The "Jane Doe" Effect)
* **NO Generic Names:** "John Doe", "Sarah Chan", or "Jack Su" are banned. Use highly creative, realistic-sounding names.
* **NO Generic Avatars:** DO NOT use standard SVG "egg" or Lucide user icons. Use creative placeholders.
* **NO Fake Numbers:** Avoid predictable outputs like `99.99%`, `50%`. Use organic, messy data (`47.2%`).
* **NO Startup Slop Names:** "Acme", "Nexus", "SmartFlow". Invent premium, contextual brand names.
* **NO Filler Words:** Avoid AI copywriting clichés like "Elevate", "Seamless", "Unleash", or "Next-Gen". Use concrete verbs.

## External Resources & Components
* **NO Broken Unsplash Links:** Do not use Unsplash. Use reliable placeholders like `https://picsum.photos/seed/{random_string}/800/600`.
* **shadcn/ui Customization:** You may use `shadcn/ui`, but NEVER in its generic default state. MUST customize radii, colors, and shadows.
* **Production-Ready Cleanliness:** Code must be extremely clean, visually striking, and meticulously refined.
