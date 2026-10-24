/**
 * Stubbed event data for the FITKIDROX website.
 *
 * Everything the UI renders about the event, categories, sponsors and
 * schools lives here so a later milestone can replace it with records from
 * a database without touching the screens.
 */

export const EVENT = {
  name: 'FITKIDROX Chandigarh 2026',
  edition: 'Inaugural flagship event',
  startDate: '2026-11-28T08:00:00+05:30',
  dateLabel: '28–29 November 2026',
  days: 'Two days · Saturday & Sunday',
  venue: 'Sector 10D Skating Rink',
  city: 'Chandigarh',
  venueStatus: 'Venue booking and suitability to be confirmed',
  targetParticipants: 1000,
  entryFee: 750,
  feeStatus: 'Proposed fee, subject to final approval',
  domain: 'www.fitkidrox.in',
  email: 'hello@fitkidrox.in',
} as const

export type CategoryId = 'mini' | 'kids' | 'athletic' | 'performance'

export interface Category {
  id: CategoryId
  name: string
  ages: string
  minAge: number
  maxAge: number | null
  focus: string
  stations: string[]
  format: string
  image: string
}

export const CATEGORIES: Category[] = [
  {
    id: 'mini',
    name: 'Mini FITKIDROX',
    ages: '3–5 years',
    minAge: 3,
    maxAge: 5,
    focus: 'Play-based movement, balance, crawling and coordination.',
    stations: ['Tunnel crawl', 'Balance beam', 'Bean-bag toss', 'Hop-the-dots'],
    format: 'Non-timed play circuit · parent may accompany',
    image: '/img/mini.png',
  },
  {
    id: 'kids',
    name: 'Kids Fitness Challenge',
    ages: '6–8 years',
    minAge: 6,
    maxAge: 8,
    focus: 'Agility, short runs, jumping and simple obstacle activities.',
    stations: ['Agility ladder', 'Mini hurdles', 'Cone shuttle', 'Frog jumps'],
    format: 'Fun-timed circuit · finisher medal for every child',
    image: '/img/relay.png',
  },
  {
    id: 'athletic',
    name: 'Athletic Challenge',
    ages: '9–12 years',
    minAge: 9,
    maxAge: 12,
    focus: 'Stamina, coordination, bodyweight movements and relay challenges.',
    stations: [
      'Shuttle runs',
      'Bear crawl',
      'Medicine-ball carry',
      'Team relay',
    ],
    format: 'Timed race · individual and school-team rankings',
    image: '/img/hero.png',
  },
  {
    id: 'performance',
    name: 'Performance FITKIDROX',
    ages: '13+ years',
    minAge: 13,
    maxAge: null,
    focus:
      'Age-appropriate endurance, strength, speed and performance challenges.',
    stations: [
      'Light sled push',
      'Farmer carry',
      'Wall-ball',
      '400 m run laps',
    ],
    format: 'Timed race · age-group podiums',
    image: '/img/teens.png',
  },
]

/** Category for a child's age on event day, or null if under 3. */
export function categoryForAge(age: number): Category | null {
  return (
    CATEGORIES.find(
      (c) => age >= c.minAge && (c.maxAge === null || age <= c.maxAge),
    ) ?? null
  )
}

/** Age in whole years on the first event day. */
export function ageOnEventDay(dob: string): number | null {
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return null
  const day = new Date(EVENT.startDate)
  let age = day.getFullYear() - birth.getFullYear()
  const m = day.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && day.getDate() < birth.getDate())) age--
  return age
}

export const SAFETY_POINTS = [
  {
    title: 'Age-appropriate rules',
    body: 'Every station is scaled by category: lighter loads, shorter distances and softer surfaces for younger children.',
  },
  {
    title: 'Trained supervision',
    body: 'Certified coaches and marshals at each station, with a fixed child-to-supervisor ratio for every heat.',
  },
  {
    title: 'First aid on site',
    body: 'A first-aid post, hydration points and an emergency response plan across both event days.',
  },
  {
    title: 'Parental consent',
    body: 'No child takes part without a signed parent or guardian consent and medical declaration.',
  },
]

export const REVENUE_STREAMS = [
  'Participant registrations',
  'School partnerships',
  'T-shirt sponsorship',
  'Title & associate sponsors',
  'Merchandise',
  'Future city events',
]

export interface SponsorPackage {
  id: string
  name: string
  tagline: string
  slots: string
  benefits: string[]
}

export const SPONSOR_PACKAGES: SponsorPackage[] = [
  {
    id: 'title',
    name: 'Title Sponsor',
    tagline: 'FITKIDROX presented by your brand',
    slots: '1 slot',
    benefits: [
      'Naming rights on all event communication',
      'Largest logo on the participant T-shirt front',
      'Main-stage and finish-arch branding',
      'Medal and certificate co-branding',
      'Activation zone for both days',
    ],
  },
  {
    id: 'tshirt',
    name: 'T-shirt Sponsor',
    tagline: 'On every participant, at every school',
    slots: 'Limited slots',
    benefits: [
      'Logo on the participant T-shirt sleeve or back',
      'Visibility in event photographs',
      'Mention in school communication',
      'Sampling at the expo area',
    ],
  },
  {
    id: 'associate',
    name: 'Associate Sponsor',
    tagline: 'Cash or in-kind partnership',
    slots: 'Multiple slots',
    benefits: [
      'Station naming, e.g. “Hydration Zone by …”',
      'Logo on website and venue banners',
      'Stall at the family expo area',
      'Social media mentions',
    ],
  },
]

export const FAQS = [
  {
    q: 'Is registration open?',
    a: 'Not yet. Paid registration opens once the venue, safety plan and entry fee are confirmed. Register your interest now and you will be first to know.',
  },
  {
    q: 'How is my child’s category decided?',
    a: 'By their age on 28 November 2026. The registration form works this out from the date of birth.',
  },
  {
    q: 'Can schools register a group?',
    a: 'Yes. Schools can submit a team roster in one go and receive one consolidated invoice. Use the Schools page.',
  },
  {
    q: 'What does the entry fee include?',
    a: 'The proposed ₹750 entry includes an event T-shirt, race bib, finisher medal and a digital certificate.',
  },
  {
    q: 'Can parents stay with their child?',
    a: 'Yes. Parents can accompany Mini FITKIDROX participants on the course and watch every other category from the spectator area.',
  },
]

export interface RosterEntry {
  id: string
  name: string
  dob: string
  gender: 'Girl' | 'Boy' | 'Other'
  tshirt: TshirtSize
}

export const TSHIRT_SIZES = [
  'XS (3–4y)',
  'S (5–6y)',
  'M (7–8y)',
  'L (9–10y)',
  'XL (11–12y)',
  'Adult S',
  'Adult M',
  'Adult L',
] as const
export type TshirtSize = (typeof TSHIRT_SIZES)[number]

export const SAMPLE_ROSTER: RosterEntry[] = [
  {
    id: 'r1',
    name: 'Aarav Sandhu',
    dob: '2016-03-14',
    gender: 'Boy',
    tshirt: 'L (9–10y)',
  },
  {
    id: 'r2',
    name: 'Mehar Kaur Gill',
    dob: '2018-09-02',
    gender: 'Girl',
    tshirt: 'M (7–8y)',
  },
  {
    id: 'r3',
    name: 'Vihaan Bansal',
    dob: '2012-06-21',
    gender: 'Boy',
    tshirt: 'Adult S',
  },
  {
    id: 'r4',
    name: 'Ishita Rana',
    dob: '2021-01-30',
    gender: 'Girl',
    tshirt: 'XS (3–4y)',
  },
]

export const PARTNER_SCHOOLS_TARGET = 25
