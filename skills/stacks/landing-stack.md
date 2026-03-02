Proyecto: Landings showcase (Awwwards level)

Tech:
- Frontend: Vue 3 / React + TS
- Animations: GSAP 3 + ScrollTrigger
- 3D: Three.js (opcional)
- Deploy: Vercel
- Performance: Lighthouse 95+

Agentes activos:

**Development:**
- animations.md (GSAP + Three.js)
- frontend-perf.md (optimización)
- react-hooks.md o vue-composition.md

**Deploy:**
- deployment.md (Vercel)

Checklist por landing:
- [ ] Performance 95+ mobile
- [ ] Animaciones 60fps
- [ ] Lazy load assets
- [ ] SEO básico
- [ ] Analytics

Stack típico:
```json
{
  "dependencies": {
    "gsap": "^3.12.0",
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "lenis": "^1.0.0"
  }
}
```