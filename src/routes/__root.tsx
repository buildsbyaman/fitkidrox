import { useEffect } from 'react'
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NotFoundPage } from '@/components/error-pages'

import '../styles.css'

const siteName = 'FITKIDROX by PSSS — Kids Fitness Challenge, Chandigarh 2026'
const siteDescription =
  'Young Minds. Stronger Bodies. Brighter Futures. FITKIDROX is India’s premier supervised, age-appropriate youth fitness race for children aged 3 to 13+. Join us 28–29 November 2026 at Sector 10D Skating Rink, Chandigarh.'
const siteKeywords =
  'FITKIDROX, fitkidrox, kids fitness challenge chandigarh, junior fitness race india, youth fitness race, hyrox for kids india, kids obstacle course chandigarh, sector 10d skating rink chandigarh, tricity kids sports event, mohali kids fitness race, panchkula school sports, children endurance race, PSSS sports foundation'
const siteUrl = 'https://www.fitkidrox.in'
const ogImageUrl = 'https://www.fitkidrox.in/img/hero.png'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=5',
      },
      {
        title: siteName,
      },
      {
        name: 'description',
        content: siteDescription,
      },
      {
        name: 'keywords',
        content: siteKeywords,
      },
      {
        name: 'author',
        content: 'PSSS & FITKIDROX Organizing Committee',
      },
      {
        name: 'robots',
        content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
      },
      {
        name: 'googlebot',
        content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
      },
      // Open Graph / Facebook
      {
        property: 'og:site_name',
        content: 'FITKIDROX',
      },
      {
        property: 'og:title',
        content: siteName,
      },
      {
        property: 'og:description',
        content: siteDescription,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: siteUrl,
      },
      {
        property: 'og:locale',
        content: 'en_IN',
      },
      {
        property: 'og:image',
        content: ogImageUrl,
      },
      {
        property: 'og:image:secure_url',
        content: ogImageUrl,
      },
      {
        property: 'og:image:type',
        content: 'image/png',
      },
      {
        property: 'og:image:width',
        content: '1200',
      },
      {
        property: 'og:image:height',
        content: '630',
      },
      {
        property: 'og:image:alt',
        content: 'FITKIDROX - Kids Fitness Challenge in Chandigarh',
      },
      // Twitter Card
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: siteName,
      },
      {
        name: 'twitter:description',
        content: siteDescription,
      },
      {
        name: 'twitter:image',
        content: ogImageUrl,
      },
      {
        name: 'twitter:image:alt',
        content: 'FITKIDROX - Kids Fitness Challenge in Chandigarh',
      },
      // Geo & Local SEO for Chandigarh & Tri-City
      {
        name: 'geo.region',
        content: 'IN-CH',
      },
      {
        name: 'geo.placename',
        content: 'Chandigarh',
      },
      {
        name: 'geo.position',
        content: '30.7516;76.7975',
      },
      {
        name: 'ICBM',
        content: '30.7516, 76.7975',
      },
      // Mobile / Theme
      {
        name: 'theme-color',
        content: '#0F172A',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'FITKIDROX',
      },
      {
        name: 'format-detection',
        content: 'telephone=no',
      },
    ],
    links: [
      { rel: 'canonical', href: siteUrl },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      // Fonts are self-hosted (public/fonts): no third-party request, no
      // supply-chain dependency, and one less GDPR/privacy loose end.
      { rel: 'stylesheet', href: '/fonts/fonts.css' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
})

function ScrollToTop() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hash = useRouterState({ select: (s) => s.location.hash })

  useEffect(() => {
    if (!hash && typeof window !== 'undefined') {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  return null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <HeadContent />
      </head>
      <body>
        <ScrollToTop />
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
