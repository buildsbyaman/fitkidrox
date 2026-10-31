import { Link } from '@tanstack/react-router'
import { ChevronDown, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth-context'
import { GoogleIcon } from './google-icon'
import { Logo } from './logo'
import { WhatsAppIcon, WHATSAPP_ENQUIRY_URL } from './whatsapp-icon'

const NAV = [
  { to: '/', hash: 'categories', label: 'Categories' },
  { to: '/', hash: 'safety', label: 'Safety' },
  { to: '/schools', label: 'Schools' },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/', hash: 'faq', label: 'FAQ' },
] as const

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()

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

          {/* WhatsApp icon to enquire */}
          <a
            href={WHATSAPP_ENQUIRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Enquire on WhatsApp (+91 73895 05338)"
            title="Enquire on WhatsApp (+91 73895 05338)"
            className="ml-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-card px-3 py-1.5 text-sm font-bold text-foreground transition-all hover:border-emerald-500 hover:bg-emerald-500/10 shadow-xs hover:scale-105"
          >
            <WhatsAppIcon className="size-6 shrink-0" />
            <span>Enquire</span>
          </a>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile WhatsApp direct button */}
          <a
            href={WHATSAPP_ENQUIRY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Enquire on WhatsApp (+91 73895 05338)"
            title="Enquire on WhatsApp"
            className="flex md:hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-card px-2.5 py-1.5 text-xs font-bold text-foreground transition-all hover:bg-emerald-500/10 active:scale-95 shadow-xs"
          >
            <WhatsAppIcon className="size-4 shrink-0" />
            <span className="text-[11px]">Enquire</span>
          </a>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-border bg-card p-1 pr-2.5 transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="User account menu"
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="size-7 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden max-w-[100px] truncate text-xs font-semibold text-foreground sm:inline-block">
                    {user.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer font-medium">
                    My Registrations
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/register" className="cursor-pointer">
                    Register child
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-xs font-bold text-foreground/80 hover:text-foreground sm:inline-flex"
            >
              <Link to="/register">Sign in</Link>
            </Button>
          )}

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

                <a
                  href={WHATSAPP_ENQUIRY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="mt-4 flex items-center justify-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-base font-bold text-foreground transition-all hover:bg-emerald-500/20"
                >
                  <WhatsAppIcon className="size-6 shrink-0" />
                  <span>Enquire on WhatsApp</span>
                </a>

                {user ? (
                  <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3.5">
                    <div className="flex items-center gap-3">
                      {user.picture ? (
                        <img
                          src={user.picture}
                          alt=""
                          className="size-10 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-sm font-bold text-foreground">
                          {user.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs font-bold"
                      >
                        <Link to="/dashboard" onClick={() => setOpen(false)}>
                          My Registrations
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          logout()
                          setOpen(false)
                        }}
                        className="w-full justify-center gap-1.5 border-border text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <LogOut className="size-3.5" />
                        <span>Sign out</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    className="mt-4 gap-2 font-bold"
                  >
                    <Link to="/register" onClick={() => setOpen(false)}>
                      <GoogleIcon className="size-4" />
                      <span>Sign in with Google</span>
                    </Link>
                  </Button>
                )}

                <Button
                  asChild
                  size="lg"
                  className="mt-4 font-bold shadow-md shadow-primary/20"
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
