---
name: design-taste-creative
description: High-end creative inspiration library, motion paradigms, and bento grid architecture for premium frontend development.
---

# Design Taste: Creative Arsenal

Do not default to generic UI. Pull from this library of advanced concepts. Leverage **GSAP** for complex scrolltelling or **ThreeJS** for 3D/Canvas animations, rather than basic CSS. **CRITICAL:** Never mix GSAP/ThreeJS with Framer Motion in the same component tree.

## The Standard Hero Paradigm
* Stop doing centered text over a dark image. Try asymmetric Hero sections: Text aligned to left or right. Background with subtle stylistic fade.

## Navigation & Menüs
* **Mac OS Dock Magnification:** Nav-bar at edge; icons scale fluidly on hover.
* **Magnetic Button:** Buttons that physically pull toward the cursor.
* **Gooey Menu:** Sub-items detach from main button like viscous liquid.
* **Dynamic Island:** Pill-shaped UI that morphs to show status/alerts.
* **Contextual Radial Menu:** Circular menu expanding at click coordinates.
* **Floating Speed Dial:** FAB that springs out into curved line of actions.
* **Mega Menu Reveal:** Full-screen dropdowns with stagger-fade content.

## Layout & Grids
* **Bento Grid:** Asymmetric, tile-based grouping (e.g., Apple Control Center).
* **Masonry Layout:** Staggered grid without fixed row heights.
* **Chroma Grid:** Tiles showing subtly animating color gradients.
* **Split Screen Scroll:** Screen halves sliding in opposite directions.
* **Curtain Reveal:** Hero parting in the middle like a curtain on scroll.

## Cards & Containers
* **Parallax Tilt Card:** 3D-tilting card tracking mouse coordinates.
* **Spotlight Border Card:** Borders that illuminate dynamically under cursor.
* **Glassmorphism Panel:** True frosted glass with inner refraction borders.
* **Holographic Foil Card:** Iridescent, rainbow light reflections on hover.
* **Tinder Swipe Stack:** Physical stack of cards to swipe away.
* **Morphing Modal:** Button that expands into full-screen dialog.

## Scroll-Animations
* **Sticky Scroll Stack:** Cards that stick and stack over each other.
* **Horizontal Scroll Hijack:** Vertical scroll translates to horizontal gallery pan.
* **Locomotive Scroll Sequence:** Video sequences where framerate tied to scrollbar.
* **Zoom Parallax:** Background image zooming in/out as you scroll.
* **Scroll Progress Path:** SVG vectors that draw themselves as you scroll.
* **Liquid Swipe Transition:** Page transitions wiping like viscous liquid.

## Galleries & Media
* **Dome Gallery:** 3D gallery feeling like panoramic dome.
* **Coverflow Carousel:** 3D carousel with center focused.
* **Drag-to-Pan Grid:** Boundless grid you can freely drag.
* **Accordion Image Slider:** Vertical strips expanding fully on hover.
* **Hover Image Trail:** Mouse leaves trail of popping/fading images.
* **Glitch Effect Image:** RGB-channel shifting on hover.

## Typography & Text
* **Kinetic Marquee:** Endless text bands reversing direction on scroll.
* **Text Mask Reveal:** Massive typography as transparent window to video.
* **Text Scramble Effect:** Matrix-style character decoding on load.
* **Circular Text Path:** Text curved along spinning circular path.
* **Gradient Stroke Animation:** Outlined text with gradient running along stroke.
* **Kinetic Typography Grid:** Grid of letters dodging from cursor.

## Micro-Interactions & Effects
* **Particle Explosion Button:** CTAs that shatter into particles on success.
* **Liquid Pull-to-Refresh:** Mobile reload indicators like detaching droplets.
* **Skeleton Shimmer:** Shifting light across placeholder boxes.
* **Directional Hover Aware Button:** Hover fill from exact side mouse entered.
* **Ripple Click Effect:** Visual waves rippling from click coordinates.
* **Animated SVG Line Drawing:** Vectors drawing their own contours.
* **Mesh Gradient Background:** Organic, lava-lamp-like animated color blobs.
* **Lens Blur Depth:** Dynamic focus blurring background layers.

---

# The "MOTION-ENGINE" BENTO PARADIGM
When generating SaaS dashboards, utilize "Bento 2.0" with perpetual physics.

## A. Core Design Philosophy
* **Aesthetic:** High-end, minimal, functional.
* **Palette:** Background `#f9fafb`. Cards pure white with 1px border `border-slate-200/50`.
* **Surfaces:** Use `rounded-[2.5rem]`. Apply "diffusion shadow" (`shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`).
* **Typography:** Strict `Geist`, `Satoshi`, or `Cabinet Grotesk`. Subtle `tracking-tight` for headers.
* **Labels:** Titles/descriptions outside and below cards (gallery-style).
* **Pixel-Perfection:** Generous `p-8` or `p-10` padding inside cards.

## B. Animation Engine Specs (Perpetual Motion)
* **Spring Physics:** No linear easing. Use `type: "spring", stiffness: 100, damping: 20`.
* **Layout Transitions:** Use `layout` and `layoutId` props for smooth re-ordering.
* **Infinite Loops:** Every card must have an "Active State" looping infinitely.
* **Performance:** Wrap dynamic lists in `<AnimatePresence>`. Memoize perpetual motion.

## C. The 5-Card Archetypes
1. **The Intelligent List:** Vertical stack with infinite auto-sorting loop using `layoutId`.
2. **The Command Input:** Search/AI bar with multi-step Typewriter Effect.
3. **The Live Status:** Scheduling with "breathing" status indicators and pop-up notifications.
4. **The Wide Data Stream:** Horizontal infinite carousel with seamless loop.
5. **The Contextual UI:** Document view with staggered highlight and floating toolbar.
