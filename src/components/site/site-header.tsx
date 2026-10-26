import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Logo } from './logo'

const NAV = [
  { to: '/', hash: 'categories', label: 'Categories' },
  { to: '/', hash: 'safety', label: 'Safety' },
  { to: '/schools', label: 'Schools' },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/', hash: 'faq', label: 'FAQ' },
] as const

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: (typeof NAV)[number],
  ) => {
    if ('hash' in item && item.hash) {
      if (typeof window !== 'undefined' && window.location.pathname === '/') {
        const el = document.getElementById(item.hash)
        if (el) {
          e.preventDefault()
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          if (window.location.hash !== `#${item.hash}`) {
            window.history.pushState(null, '', `#${item.hash}`)
          }
        }
      }
    }
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="FITKIDROX home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              hash={'hash' in item ? item.hash : undefined}
              onClick={(e) => handleNavClick(e, item)}
              className="rounded-md px-3 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:text-foreground motion-reduce:transition-none"
              activeProps={
                'hash' in item ? undefined : { className: 'text-primary' }
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden font-bold sm:inline-flex">
            <Link to="/register">Register your child</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="bg-card text-foreground border-l border-border"
            >
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
                <SheetDescription className="text-muted-foreground">
                  28–29 November 2026 · Chandigarh
                </SheetDescription>
              </SheetHeader>
              <nav
                className="flex flex-col gap-1 px-4 mt-6"
                aria-label="Mobile"
              >
                {NAV.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    hash={'hash' in item ? item.hash : undefined}
                    onClick={(e) => handleNavClick(e, item)}
                    className="font-display rounded-md py-2 text-2xl font-black uppercase text-foreground hover:text-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
                <Button
                  asChild
                  size="lg"
                  className="mt-6 font-bold shadow-md shadow-primary/20"
                >
                  <Link to="/register" onClick={() => setOpen(false)}>
                    Register your child
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
