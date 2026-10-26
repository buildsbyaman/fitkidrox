import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Field, fieldAria, PageHero } from '@/components/site/field'
import { PageShell } from '@/components/site/page-shell'
import { SuccessConfirmation } from '@/components/site/success-confirmation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EVENT } from '@/data/fixtures'
import { submitSchoolEntry } from '@/data/api'
import { formatINR } from '@/lib/format'

const schoolsStructuredData = {
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
      name: 'School Entries',
      item: 'https://www.fitkidrox.in/schools',
    },
  ],
}

export const Route = createFileRoute('/schools')({
  head: () => ({
    meta: [
      {
        title: 'School Entries & Partnerships · FITKIDROX Chandigarh 2026',
      },
      {
        name: 'description',
        content:
          'Register your school team for FITKIDROX Chandigarh 2026. Inter-school youth fitness competition across Chandigarh, Mohali & Panchkula with dedicated school leaderboards and bulk entry.',
      },
      {
        property: 'og:title',
        content: 'School Entries & Partnerships · FITKIDROX Chandigarh 2026',
      },
      {
        property: 'og:description',
        content:
          'Empower your students with fitness, teamwork, and athletic confidence. Register school delegations for FITKIDROX 2026.',
      },
      { property: 'og:url', content: 'https://www.fitkidrox.in/schools' },
    ],
    links: [{ rel: 'canonical', href: 'https://www.fitkidrox.in/schools' }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(schoolsStructuredData),
      },
    ],
  }),
  component: SchoolsPage,
})

interface SchoolForm {
  schoolName: string
  city: string
  coordinator: string
  phone: string
  email: string
  participants: string
}

function SchoolsPage() {
  const [school, setSchool] = useState<SchoolForm>({
    schoolName: '',
    city: 'Chandigarh',
    coordinator: '',
    phone: '',
    email: '',
    participants: '',
  })
  const [errors, setErrors] = useState<
    Partial<Record<keyof SchoolForm, string>>
  >({})
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  function setField(key: keyof SchoolForm, value: string) {
    setSchool((s) => ({ ...s, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const approxCount = Number.parseInt(school.participants, 10) || 0

  async function submit() {
    const e: typeof errors = {}
    if (school.schoolName.trim().length < 3)
      e.schoolName = 'Enter the school name.'
    if (school.coordinator.trim().length < 2)
      e.coordinator = 'Enter the coordinator’s name.'
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(school.phone.replace(/\s/g, '')))
      e.phone = 'Enter a valid 10-digit mobile number.'
    if (!/^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(school.email))
      e.email = 'Enter a valid email address.'
    if (!school.participants || approxCount < 1)
      e.participants =
        'Please provide an approximate number of students (minimum 1).'

    setErrors(e)
    if (Object.keys(e).length) return

    setSubmitting(true)
    try {
      const res = await submitSchoolEntry({
        schoolName: school.schoolName.trim(),
        city: school.city.trim(),
        coordinator: school.coordinator.trim(),
        phone: school.phone.trim(),
        email: school.email.trim(),
        participants: approxCount,
        roster: [],
      })
      setReference(res.reference)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      toast.success('School request submitted successfully', {
        description: `Reference: ${res.reference}`,
      })
    } catch {
      toast.error('We couldn’t submit the request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (reference) {
    return (
      <SuccessConfirmation
        eyebrow="School Entry Received"
        title={`${school.schoolName} is registered!`}
        description={
          <>
            Thank you! We have received your participation request for approximately{' '}
            <strong className="text-foreground">{approxCount} students</strong>.
            Our school partnerships team will contact{' '}
            <strong className="text-foreground">{school.coordinator}</strong> within
            two working days with event slots, parent consent packets, and coordinator
            credentials.
          </>
        }
        reference={reference}
        referenceSubtext={`~${approxCount} students · City: ${school.city}`}
        recipientEmail={school.email}
        secondaryAction={{
          label: 'Submit another school',
          onClick: () => {
            setReference(null)
            setSchool({
              schoolName: '',
              city: 'Chandigarh',
              coordinator: '',
              phone: '',
              email: '',
              participants: '',
            })
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
          },
        }}
      />
    )
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="School partnerships"
        title={
          <>
            Bring your <span className="text-primary">whole school</span>
          </>
        }
      >
        One coordinator, one invoice. Partner schools compete for the
        school-team trophy and get reserved slots at FITKIDROX.
      </PageHero>

      <div className="mx-auto grid max-w-content gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <section
            className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm"
            aria-labelledby="school-details"
          >
            <div className="flex items-center gap-3">
              <div>
                <h2
                  id="school-details"
                  className="font-display text-3xl font-black uppercase text-foreground"
                >
                  School &amp; Delegation Details
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Provide your institution's info and estimated student
                  participation count.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <Field
                id="schoolName"
                label="School name"
                error={errors.schoolName}
                className="sm:col-span-2"
              >
                <Input
                  {...fieldAria('schoolName', errors.schoolName)}
                  value={school.schoolName}
                  onChange={(e) => setField('schoolName', e.target.value)}
                  placeholder="e.g. Doon Valley Senior Secondary School, Sector 22"
                />
              </Field>

              <Field id="city" label="City">
                <Select
                  value={school.city}
                  onValueChange={(v) => setField('city', v)}
                >
                  <SelectTrigger id="city" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'Chandigarh',
                      'Mohali',
                      'Panchkula',
                      'Zirakpur',
                      'Other',
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                id="participants"
                label="Approximate number of students"
                error={errors.participants}
              >
                <Input
                  {...fieldAria('participants', errors.participants)}
                  type="number"
                  min="1"
                  max="10000"
                  value={school.participants}
                  onChange={(e) => setField('participants', e.target.value)}
                  placeholder="e.g. 50"
                />
              </Field>

              <Field
                id="coordinator"
                label="Sports coordinator / Lead teacher"
                error={errors.coordinator}
              >
                <Input
                  {...fieldAria('coordinator', errors.coordinator)}
                  value={school.coordinator}
                  onChange={(e) => setField('coordinator', e.target.value)}
                  placeholder="e.g. Ravi Sharma"
                />
              </Field>

              <Field id="phone" label="Mobile number" error={errors.phone}>
                <Input
                  {...fieldAria('phone', errors.phone)}
                  type="tel"
                  value={school.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="9876543210"
                />
              </Field>

              <Field
                id="email"
                label="Official email"
                error={errors.email}
                className="sm:col-span-2"
              >
                <Input
                  {...fieldAria('email', errors.email)}
                  type="email"
                  value={school.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="coordinator@school.edu.in"
                />
              </Field>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-border/80 bg-card p-6 shadow-sm lg:sticky lg:top-24">
          <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Delegation Summary
          </span>
          <div className="mt-4 flex items-baseline gap-2">
            <Users className="size-6 text-primary" />
            <p className="font-display text-5xl font-black text-foreground">
              {approxCount}
            </p>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            approx. students registered
          </p>

          <div className="mt-6 flex items-baseline justify-between border-t border-border/70 pt-5">
            <span className="text-sm text-muted-foreground font-medium">
              Estimated total
            </span>
            <span className="font-display text-3xl font-black text-primary">
              {formatINR(approxCount * EVENT.entryFee)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatINR(EVENT.entryFee)} per student standard rate. Special bulk
            pricing applied on final invoice.
          </p>

          <Button
            size="lg"
            className="mt-6 w-full font-bold shadow-md shadow-primary/20"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> Submitting…
              </>
            ) : (
              'Submit school request'
            )}
          </Button>
          <p className="mt-3 text-xs text-center text-muted-foreground">
            No payment required today.
          </p>
        </aside>
      </div>
    </PageShell>
  )
}
