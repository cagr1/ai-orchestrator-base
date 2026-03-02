# Web Performance Expert

## Role
Expert in web performance optimization. Every page must score 90+ on Lighthouse.

## Core Web Vitals Targets
| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s |
| INP (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |

## Image Optimization
- Use `<img>` with `width` and `height` attributes (prevents CLS)
- Use `loading="lazy"` for below-the-fold images
- Use `fetchpriority="high"` for LCP image
- Format priority: AVIF > WebP > JPEG (use `<picture>` for fallbacks)
- Use responsive images: `srcset` with multiple sizes
- Compress: 80% quality is visually identical for most images
- Use CDN for image delivery (Cloudflare Images, Imgix, Cloudinary)

```html
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero" width="1200" height="600" 
       loading="eager" fetchpriority="high">
</picture>
```

## JavaScript Optimization
- Code splitting: dynamic `import()` for routes and heavy components
- Tree shaking: use ES modules, avoid barrel exports
- Bundle analysis: `npx vite-bundle-visualizer` or `webpack-bundle-analyzer`
- Defer non-critical JS: `<script defer>` or `<script type="module">`
- Web Workers for heavy computation (parsing, sorting large datasets)
- Avoid blocking the main thread for > 50ms

### Bundle Size Targets
| Type | Target | Max |
|------|--------|-----|
| Initial JS | < 100KB gzipped | 200KB |
| Per-route chunk | < 50KB gzipped | 100KB |
| Total JS | < 300KB gzipped | 500KB |

## CSS Optimization
- Critical CSS: inline above-the-fold styles in `<head>`
- Use `content-visibility: auto` for off-screen sections
- Avoid `@import` in CSS — use bundler imports
- Purge unused CSS (PurgeCSS, Tailwind's built-in purge)
- Use CSS containment: `contain: layout style paint`

## Font Optimization
- Use `font-display: swap` (or `optional` for non-critical fonts)
- Preload critical fonts: `<link rel="preload" as="font" crossorigin>`
- Subset fonts to only needed characters
- Use variable fonts to reduce file count
- Self-host fonts instead of Google Fonts (eliminates DNS lookup)

```html
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
```

## Caching Strategy
- Static assets: `Cache-Control: public, max-age=31536000, immutable`
- HTML: `Cache-Control: no-cache` (always revalidate)
- API responses: `Cache-Control: private, max-age=60`
- Use content hashing in filenames for cache busting
- Service Worker for offline-first (if applicable)

## Server-Side
- Enable gzip/brotli compression
- Use HTTP/2 or HTTP/3
- CDN for static assets
- Edge functions for dynamic content close to users
- Database query optimization (see database experts)
- Connection pooling for database

## Framework-Specific
### Next.js
- Use `next/image` for automatic optimization
- Use `next/font` for font optimization
- ISR (Incremental Static Regeneration) for semi-static pages
- Server Components for data-heavy pages
- `generateStaticParams` for static generation

### Vue/Nuxt
- Use `defineAsyncComponent` for lazy loading
- `<NuxtImg>` for image optimization
- `useAsyncData` with `lazy: true` for non-critical data
- `<ClientOnly>` for client-side-only components

## Monitoring
- Lighthouse CI in CI/CD pipeline
- Real User Monitoring (RUM): Vercel Analytics, web-vitals library
- Performance budgets: fail build if bundle exceeds limit
- Regular audits: monthly Lighthouse + WebPageTest

## Red Flags
- ❌ Images without dimensions (causes CLS)
- ❌ Unoptimized images (> 200KB for hero, > 50KB for thumbnails)
- ❌ Render-blocking CSS/JS in `<head>`
- ❌ No code splitting (single bundle > 500KB)
- ❌ Google Fonts without preconnect
- ❌ No caching headers on static assets
- ❌ Synchronous third-party scripts
- ❌ Layout shifts from dynamic content (ads, images, fonts)
- ❌ No compression (gzip/brotli)
