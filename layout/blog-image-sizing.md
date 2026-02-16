# Blog Image Sizing Best Practices (2026)

## Recommended Dimensions by Use Case

| Use Case | Dimensions | Aspect Ratio | Notes |
|----------|-----------|--------------|-------|
| Blog hero / featured image | 1200 x 630 px | ~1.9:1 | Works for both layout AND OG sharing |
| Full-width blog header | 1280 x 720 px | 16:9 | Most universal across devices |
| Social sharing (OG image) | 1200 x 630 px | ~1.9:1 | Facebook/LinkedIn/Twitter standard |
| Retina-ready (640px column) | 1280 px wide (2x) | 16:9 or 3:2 | Browser renders at 640px |

## Aspect Ratios

- **16:9** — Most universal across devices and platforms. Standard for video and web.
- **1.9:1 (~1200x630)** — OG-friendly. Works as both hero image and social preview without separate crop.
- **3:2** — Common for photography. Taller than ideal for blog headers — dominates vertical space in narrow columns.
- **1:1** — Square. Only for thumbnails or specific design choices.

**Rule of thumb:** For blog content columns under 800px, use 16:9 or wider. Taller ratios (3:2, 4:3) overwhelm narrow layouts.

## Content Column Width Mapping

The image width should match or exceed the content column width. For retina displays, serve 2x.

| Column Width | Image Width (1x) | Image Width (2x/Retina) |
|-------------|-----------------|------------------------|
| 640px | 640px | 1280px |
| 768px | 768px | 1536px |
| 1024px | 1024px | 2048px |

## Responsive Srcset Strategy

For a 640px content column, serve 3 sizes:
- **480px** — Mobile (< 480px viewport)
- **768px** — Tablet / small desktop
- **1024px** — Desktop retina (640px × ~1.6x)

```html
<picture>
    <source srcset="image-480.webp 480w,
                     image-768.webp 768w,
                     image-1024.webp 1024w"
            sizes="(max-width: 680px) 100vw, 640px"
            type="image/webp">
    <img src="image-1024.png"
         srcset="image-480.png 480w,
                 image-768.png 768w,
                 image-1024.png 1024w"
         sizes="(max-width: 680px) 100vw, 640px"
         alt="Descriptive alt text"
         width="1024" height="576"
         class="article-hero"
         loading="eager">
</picture>
```

## File Size Targets

| Image Type | Target Size | Max Size |
|-----------|------------|---------|
| Blog hero (full-width) | < 150 KB | 200 KB |
| Blog card thumbnail | < 50 KB | 100 KB |
| OG / social share | < 100 KB | 150 KB |

## Format Priority

1. **WebP** — 25-35% smaller than JPEG at equivalent quality. Universal browser support (2025+).
2. **AVIF** — Even smaller than WebP. Browser support still growing.
3. **PNG** — Fallback only. Use for transparency or when WebP not supported.

## SEO Considerations

- **Filename:** Match the URL slug (e.g., `when-team-grows-faster-than-system-1024.webp`)
- **Alt text:** Descriptive, includes key topic phrases. Not keyword-stuffed.
- **Dimensions in HTML:** Always set `width` and `height` attributes to prevent layout shift (CLS).
- **Loading:** `loading="eager"` for above-the-fold hero. `loading="lazy"` for blog index cards.

## OG Image Tips

- OG image should be the same as the blog hero when possible (1200x630 works for both)
- Always include `og:image:width` and `og:image:height` meta tags
- LinkedIn, Facebook, Twitter all use OG image — one size fits all at 1200x630
- LinkedIn Post Inspector: verify OG image after deploy

## Sources

- [Website Image Size Guide 2026 - tiny-img](https://tiny-img.com/blog/best-image-size-for-website/)
- [Website Image Size Guidelines 2026 - Shopify](https://www.shopify.com/blog/image-sizes)
- [Hero Image Sizing Guide - CronyxDigital](https://www.cronyxdigital.com/blog/hero-image-sizing-guide-for-desktop-mobile)
- [Blog Image Size Best Practices - Creole Studios](https://www.creolestudios.com/best-blog-image-size-wordpress/)
- [Blog Post Image Size - ImageSuggest](https://imagesuggest.com/blog/blog-post-image-size/)
