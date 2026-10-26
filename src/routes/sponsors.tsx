import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Award,
  Check,
  Loader2,
  Mail,
  Send,
  Target,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Field, fieldAria, PageHero } from '@/components/site/field'
import { PageShell } from '@/components/site/page-shell'
import { SuccessConfirmation } from '@/components/site/success-confirmation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EVENT, SPONSOR_PACKAGES } from '@/data/fixtures'
import { submitSponsorEnquiry } from '@/data/api'
import { cn } from '@/lib/utils'

const sponsorsStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://www.fitkidrox.in/',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Sponsor Opportunities',
      item: 'https://www.fitkidrox.in/sponsors',
    },
  ],
}

export const Route = createFileRoute('/sponsors')({
  head: () => ({
    meta: [
      {
        title:
          'Sponsor FITKIDROX 2026 · Youth Sports & Brand Partnership Opportunities',
      },
      {
        name: 'description',
        content:
          'Partner with FITKIDROX Chandigarh 2026. Connect your brand with 1,000+ junior athletes, 25+ partner schools, and thousands of health-focused families across the Tri-City.',
      },
      {
        property: 'og:title',
        content:
          'Sponsor FITKIDROX 2026 · Youth Sports & Brand Partnership Opportunities',
      },
      {
        property: 'og:description',
        content:
          'Explore Title, Category, Hydration, Finish Line & Equipment sponsorship packages for India’s premier youth fitness challenge.',
      },
      { property: 'og:url', content: 'https://www.fitkidrox.in/sponsors' },
    ],
    links: [{ rel: 'canonical', href: 'https://www.fitkidrox.in/sponsors' }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(sponsorsStructuredData),
      },
    ],
  }),
  component: SponsorsPage,
})

const EMPTY = { company: '', contact: '', email: '', phone: '', message: '' }
type Form = typeof EMPTY

function SponsorsPage() {
  const [packageId, setPackageId] = useState('title')
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Form>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{
    reference: string
    company: string
    contact: string
    email: string
    packageName: string
  } | null>(null)

  function set(key: keyof Form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function handlePackageSelect(id: string) {
    setPackageId(id)
    const formEl = document.getElementById('enquiry-form')
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const selected = SPONSOR_PACKAGES.find((p) => p.id === packageId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Partial<Form> = {}
    if (form.company.trim().length < 2)
      errs.company = 'Enter your company or brand name.'
    if (form.contact.trim().length < 2) errs.contact = 'Enter a contact name.'
    if (!/^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(form.email))
      errs.email = 'Enter a valid email address.'
    if (
      form.phone.trim() &&
      !/^(\+91[\s-]?)?[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ''))
    ) {
      errs.phone = 'Enter a valid 10-digit mobile number.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      const res = await submitSponsorEnquiry({ ...form, packageId })
      setSubmitted({
        reference: res.reference,
        company: form.company.trim(),
        contact: form.contact.trim(),
        email: form.email.trim(),
        packageName: selected?.name ?? 'Sponsorship',
      })
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      toast.success('Enquiry submitted successfully', {
        description: `Reference code: ${res.reference}`,
      })
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'We couldn’t send your enquiry. Please try again.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <SuccessConfirmation
        eyebrow="Partnership Enquiry Received"
        title={`Thank you, ${submitted.company}!`}
        description={
          <>
            We have received your sponsorship enquiry for the{' '}
            <strong className="text-foreground">{submitted.packageName}</strong>{' '}
            tier. Our brand partnerships team will review your requirements and
            contact{' '}
            <strong className="text-foreground">{submitted.contact}</strong> within
            two working days.
          </>
        }
        reference={submitted.reference}
        referenceSubtext={`${submitted.packageName} · Priority Review`}
        recipientEmail={submitted.email}
        secondaryAction={{
          label: 'Send another enquiry',
          onClick: () => {
            setSubmitted(null)
            setForm(EMPTY)
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
          },
        }}
      />
    )
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Partner with us"
        title={
          <>
            Put your brand{' '}
            <span className="text-primary">on the start line</span>
          </>
        }
      >
        Reach Chandigarh families through approved, child-safe event promotion:
        on T-shirts, medals, the finish arch, and across our school network.
      </PageHero>

      {/* Sponsorship Tiers */}
      <section className="mx-auto max-w-content px-4 py-16 sm:px-6">
        <div className="mb-8">
          <span className="text-xs font-bold tracking-widest text-primary uppercase">
            Step 1
          </span>
          <h2 className="font-display mt-1 text-3xl font-black uppercase sm:text-4xl">
            Choose a partnership tier
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a package below to link it to your sponsorship enquiry.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {SPONSOR_PACKAGES.map((p) => {
            const active = p.id === packageId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePackageSelect(p.id)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col rounded-2xl border p-7 text-left transition-all motion-reduce:transition-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none bg-card cursor-pointer',
                  active
                    ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10 bg-primary/[0.02]'
                    : 'border-border/80 hover:border-primary/40 hover:shadow-md',
                )}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-semibold">
                    {p.slots}
                  </Badge>
                  {active && (
                    <span className="text-xs font-bold tracking-widest text-primary uppercase">
                      Selected
                    </span>
                  )}
                </div>
                <h3 className="font-display mt-5 text-4xl font-black uppercase">
                  {p.name}
                </h3>
                <p className="mt-1 text-muted-foreground">{p.tagline}</p>
                <ul className="mt-6 space-y-2.5 text-sm flex-1">
                  {p.benefits.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>{active ? 'Currently chosen' : 'Click to select'}</span>
                  <span className="font-bold text-primary">
                    {active ? '✓ Chosen' : 'Select →'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Package pricing is shared on request. Cash and in-kind partnerships
          (beverage, nutrition, first-aid, media) are welcome.
        </p>
      </section>

      {/* Enquiry Section & Value Props */}
      <section
        id="enquiry-form"
        className="track-lines border-t border-border/70 py-16 scroll-mt-16"
      >
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] items-start">
            {/* Left Column: Why Partner & Sponsor Reassurance */}
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold tracking-widest text-primary uppercase">
                  Step 2 · Brand Impact
                </span>
                <h2 className="font-display mt-1 text-3xl font-black uppercase sm:text-4xl">
                  Why partner with FITKIDROX?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Unlike passive billboards, FITKIDROX places your brand at the
                  emotional center of healthy family milestones, children's race
                  day triumphs, and community fitness.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-xl border bg-card p-4.5">
                  <div className="flex items-start gap-3.5">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Award className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Main Stage &amp; Race Kit Branding
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Your logo prominently placed on participant bibs,
                        finisher T-shirts, medals, and the central photo finish
                        arch.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4.5">
                  <div className="flex items-start gap-3.5">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Dedicated Expo &amp; Sampling Booth
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Reserved experiential kiosk space in the spectator arena
                        for sampling, giveaways, and direct parent
                        conversations.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4.5">
                  <div className="flex items-start gap-3.5">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Target className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Tri-City School Network Reach
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Direct communication sent across partner schools in
                        Chandigarh, Mohali, and Panchkula in the weeks leading
                        up to the race.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3 text-xs text-muted-foreground">
                <Mail className="size-4 text-primary shrink-0" />
                <span>
                  Prefer custom partnership terms or in-kind sponsorship? Write
                  directly to{' '}
                  <a
                    href={`mailto:${EVENT.email}`}
                    className="font-semibold text-primary underline"
                  >
                    {EVENT.email}
                  </a>
                </span>
              </div>
            </div>

            {/* Right Column: Enquiry Form Card */}
            <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm">
              <div className="border-b border-border pb-4 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-black uppercase sm:text-3xl">
                    Sponsor enquiry
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-primary text-primary font-bold"
                  >
                    {selected?.name}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Interested in{' '}
                  <strong className="text-foreground">{selected?.name}</strong>.
                  You can click any package above to switch your selection.
                </p>
              </div>

              <form onSubmit={submit} noValidate className="space-y-4">
                <Field
                    id="company"
                    label="Company / Brand name"
                    error={errors.company}
                  >
                    <Input
                      {...fieldAria('company', errors.company)}
                      value={form.company}
                      onChange={(e) => set('company', e.target.value)}
                      placeholder="e.g. HealthKart / Enerzal"
                      autoComplete="organization"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="contact"
                      label="Contact person"
                      error={errors.contact}
                    >
                      <Input
                        {...fieldAria('contact', errors.contact)}
                        value={form.contact}
                        onChange={(e) => set('contact', e.target.value)}
                        placeholder="e.g. Neha Sharma"
                        autoComplete="name"
                      />
                    </Field>
                    <Field
                      id="sp-phone"
                      label="Phone (optional)"
                      error={errors.phone}
                    >
                      <Input
                        {...fieldAria('sp-phone', errors.phone)}
                        type="tel"
                        value={form.phone}
                        onChange={(e) => set('phone', e.target.value)}
                        placeholder="9876543210"
                        autoComplete="tel"
                      />
                    </Field>
                  </div>

                  <Field id="sp-email" label="Work email" error={errors.email}>
                    <Input
                      {...fieldAria('sp-email', errors.email)}
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="neha@company.com"
                      autoComplete="email"
                    />
                  </Field>

                  <Field
                    id="message"
                    label="What would you like to achieve? (optional)"
                  >
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(e) => set('message', e.target.value)}
                      placeholder="Product sampling, race day experiential booth, hydration supply, brand promotion…"
                      rows={3}
                    />
                  </Field>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full font-bold mt-2"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" /> Sending enquiry…
                      </>
                    ) : (
                      <>
                        Send enquiry for {selected?.name}{' '}
                        <Send className="ml-1 size-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground mt-2">
                    No financial commitment required now. Pricing deck shared on
                    enquiry.
                  </p>
                </form>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
