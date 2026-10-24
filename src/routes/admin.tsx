import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  LogOut,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'participants' | 'schools' | 'sponsors'

interface Participant {
  _id: string
  reference: string
  childName: string
  dob: string
  gender: string
  tshirt: string
  school: string
  category: string
  guardianName: string
  guardianPhone: string
  guardianEmail: string
  relation: string
  medicalNotes: string
  consentParticipation: boolean
  consentMedical: boolean
  consentPhotos: boolean
  createdAt: string
}

interface School {
  _id: string
  reference: string
  schoolName: string
  city: string
  coordinator: string
  phone: string
  email: string
  participants: number
  createdAt: string
}

interface Sponsor {
  _id: string
  reference: string
  company: string
  contact: string
  email: string
  phone: string
  packageId: string
  message: string
  createdAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function age(dob: string) {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) + 'y'
}

function exportCsv(rows: object[], filename: string, label = 'records') {
  if (!rows.length) {
    toast.error('Nothing to export', {
      description: `There are 0 ${label} matching current filters.`,
    })
    return
  }
  const keys = Object.keys(rows[0])
  const csv = [
    keys.join(','),
    ...rows.map((r) =>
      keys
        .map((k) => JSON.stringify((r as Record<string, unknown>)[k] ?? ''))
        .join(','),
    ),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  toast.success('CSV Downloaded', {
    description: `Exported ${rows.length} ${label} to ${filename}.`,
  })
}

function copyToClipboard(text: string, label: string) {
  if (!text) return
  void navigator.clipboard.writeText(text)
  toast.success(`Copied ${label}`, { description: text })
}

// ─────────────────────────────────────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────────────────────────────────────

async function apiLogin(email: string, password: string) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(
      (data as { error?: string }).error ?? 'Invalid email or password',
    )
  }
  return res.json()
}

async function apiLogout() {
  await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
}

async function apiCheckSession() {
  const res = await fetch('/api/admin/me', { credentials: 'include' })
  return res.ok
}

async function apiCollection<T>(collection: string): Promise<T[]> {
  const res = await fetch(`/api/admin/${collection}?limit=1000`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Failed to fetch ${collection}`)
  const data = (await res.json()) as { docs: T[] }
  return data.docs
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Screen (Clean, Plain White Theme)
// ─────────────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiLogin(email, password)
      toast.success('Signed in successfully', {
        description: 'Welcome to FITKIDROX Admin Panel.',
      })
      onLogin()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg)
      toast.error('Authentication failed', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            FITKIDROX
          </h1>
          <p className="mt-1 text-sm text-slate-500">Administrator Sign In</p>
        </div>

        <div className="mt-8 bg-white py-8 px-6 border border-slate-200 rounded-lg shadow-sm sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="admin-email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Email address
              </label>
              <input
                ref={emailRef}
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fitkidrox.in"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort / Filter hook & Table Header
// ─────────────────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

function useSortFilter<T extends Record<string, unknown>>(data: T[]) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = data.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
  )

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = String(av).localeCompare(String(bv), undefined, {
      numeric: true,
    })
    return sortDir === 'asc' ? cmp : -cmp
  })

  return { query, setQuery, sorted, sortKey, sortDir, handleSort }
}

function Th({
  label,
  field,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  field: string
  sortKey: string
  sortDir: SortDir
  onSort: (k: string) => void
}) {
  const active = sortKey === field
  return (
    <th
      onClick={() => onSort(field)}
      className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
    >
      <div className="inline-flex items-center gap-1.5">
        <span>{label}</span>
        <span className="text-slate-400">
          {active ? (
            sortDir === 'asc' ? (
              <ChevronUp size={13} className="text-slate-900" />
            ) : (
              <ChevronDown size={13} className="text-slate-900" />
            )
          ) : (
            <ChevronDown size={13} className="opacity-30" />
          )}
        </span>
      </div>
    </th>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Participants Table
// ─────────────────────────────────────────────────────────────────────────────

function ParticipantsTable({ data }: { data: Participant[] }) {
  const { query, setQuery, sorted, sortKey, sortDir, handleSort } =
    useSortFilter(data as unknown as Record<string, unknown>[])
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            id="participants-search"
            type="text"
            placeholder="Search participants, guardian, school…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {sorted.length} {sorted.length === 1 ? 'record' : 'records'}
          </span>
          <button
            id="participants-export-btn"
            onClick={() =>
              exportCsv(
                sorted as unknown as object[],
                'participants.csv',
                'participants',
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr>
              <Th
                label="Ref"
                field="reference"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Child Name"
                field="childName"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Age"
                field="dob"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Gender"
                field="gender"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Category"
                field="category"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="T-Shirt"
                field="tshirt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="School"
                field="school"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Guardian"
                field="guardianName"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Phone"
                field="guardianPhone"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Email"
                field="guardianEmail"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Registered"
                field="createdAt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No participants found.
                </td>
              </tr>
            )}
            {(sorted as unknown as Participant[]).flatMap((p) => {
              const rows = [
                <tr
                  key={p._id}
                  onClick={() => setExpanded(expanded === p._id ? null : p._id)}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                    expanded === p._id ? 'bg-slate-50/70' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(p.reference, 'Reference ID')
                      }}
                      title="Click to copy reference"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                    >
                      {p.reference}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {p.childName}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {age(p.dob)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                      {p.gender || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {p.category || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {p.tshirt || '—'}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 whitespace-nowrap max-w-[160px] truncate"
                    title={p.school}
                  >
                    {p.school || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {p.guardianName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {p.guardianPhone}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 whitespace-nowrap max-w-[180px] truncate"
                    title={p.guardianEmail}
                  >
                    {p.guardianEmail}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(p.createdAt)}
                  </td>
                </tr>,
              ]

              if (expanded === p._id) {
                rows.push(
                  <tr key={`${p._id}-expanded`}>
                    <td colSpan={11} className="p-0">
                      <div className="bg-slate-50 px-6 py-4 border-t border-b border-slate-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Date of Birth
                            </span>
                            <span className="text-slate-800 font-medium">
                              {p.dob || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Relationship
                            </span>
                            <span className="text-slate-800 font-medium">
                              {p.relation || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Participation Consent
                            </span>
                            <span
                              className={
                                p.consentParticipation
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-red-600 font-medium'
                              }
                            >
                              {p.consentParticipation ? 'Granted' : 'Declined'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Medical / Photo Consent
                            </span>
                            <span className="text-slate-800 font-medium">
                              Med: {p.consentMedical ? 'Yes' : 'No'} · Photo:{' '}
                              {p.consentPhotos ? 'Yes' : 'No'}
                            </span>
                          </div>
                          {p.medicalNotes && (
                            <div className="col-span-2 sm:col-span-4 mt-1">
                              <span className="text-slate-400 block font-medium">
                                Medical Notes
                              </span>
                              <p className="text-slate-800 mt-1 bg-white p-2.5 rounded border border-slate-200">
                                {p.medicalNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>,
                )
              }
              return rows
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Schools Table
// ─────────────────────────────────────────────────────────────────────────────

function SchoolsTable({ data }: { data: School[] }) {
  const { query, setQuery, sorted, sortKey, sortDir, handleSort } =
    useSortFilter(data as unknown as Record<string, unknown>[])
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            id="schools-search"
            type="text"
            placeholder="Search schools, coordinator, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {sorted.length} {sorted.length === 1 ? 'school' : 'schools'}
          </span>
          <button
            id="schools-export-btn"
            onClick={() =>
              exportCsv(sorted as unknown as object[], 'schools.csv', 'schools')
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr>
              <Th
                label="Ref"
                field="reference"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="School Name"
                field="schoolName"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="City"
                field="city"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Coordinator"
                field="coordinator"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Phone"
                field="phone"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Email"
                field="email"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Approx. Students"
                field="participants"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Registered"
                field="createdAt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No schools found.
                </td>
              </tr>
            )}
            {(sorted as unknown as School[]).flatMap((sc) => {
              const rows = [
                <tr
                  key={sc._id}
                  onClick={() =>
                    setExpanded(expanded === sc._id ? null : sc._id)
                  }
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                    expanded === sc._id ? 'bg-slate-50/70' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(sc.reference, 'Reference ID')
                      }}
                      title="Click to copy reference"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                    >
                      {sc.reference}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {sc.schoolName}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {sc.city || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {sc.coordinator}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {sc.phone}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 whitespace-nowrap max-w-[180px] truncate"
                    title={sc.email}
                  >
                    {sc.email}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                      {sc.participants} students
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(sc.createdAt)}
                  </td>
                </tr>,
              ]

              if (expanded === sc._id) {
                rows.push(
                  <tr key={`${sc._id}-detail`}>
                    <td colSpan={8} className="p-0">
                      <div className="bg-slate-50 px-6 py-4 border-t border-b border-slate-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">
                              School Name
                            </span>
                            <span className="text-slate-800 font-medium">
                              {sc.schoolName}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              City / Region
                            </span>
                            <span className="text-slate-800 font-medium">
                              {sc.city || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Sports Coordinator
                            </span>
                            <span className="text-slate-800 font-medium">
                              {sc.coordinator}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">
                              Approx. Students
                            </span>
                            <span className="text-slate-800 font-medium">
                              {sc.participants} students
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>,
                )
              }
              return rows
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sponsors Table
// ─────────────────────────────────────────────────────────────────────────────

function SponsorsTable({ data }: { data: Sponsor[] }) {
  const { query, setQuery, sorted, sortKey, sortDir, handleSort } =
    useSortFilter(data as unknown as Record<string, unknown>[])

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            id="sponsors-search"
            type="text"
            placeholder="Search company, contact, package…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm rounded-md border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {sorted.length} {sorted.length === 1 ? 'sponsor' : 'sponsors'}
          </span>
          <button
            id="sponsors-export-btn"
            onClick={() =>
              exportCsv(
                sorted as unknown as object[],
                'sponsors.csv',
                'sponsors',
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr>
              <Th
                label="Ref"
                field="reference"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Company"
                field="company"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Contact Person"
                field="contact"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Email"
                field="email"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Phone"
                field="phone"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Package"
                field="packageId"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Message"
                field="message"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <Th
                label="Submitted"
                field="createdAt"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No sponsors found.
                </td>
              </tr>
            )}
            {(sorted as unknown as Sponsor[]).map((sp) => (
              <tr key={sp._id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      copyToClipboard(sp.reference, 'Reference ID')
                    }}
                    title="Click to copy reference"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                  >
                    {sp.reference}
                  </button>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                  {sp.company}
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {sp.contact}
                </td>
                <td
                  className="px-4 py-3 text-slate-500 whitespace-nowrap max-w-[180px] truncate"
                  title={sp.email}
                >
                  {sp.email}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                  {sp.phone}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                    {sp.packageId}
                  </span>
                </td>
                <td
                  className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap max-w-[200px] truncate"
                  title={sp.message}
                >
                  {sp.message || '—'}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {formatDate(sp.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Component (Clean, Plain White Theme)
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('participants')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const reload = async () => {
    setRefreshing(true)
    setError('')
    try {
      const [p, sc, sp] = await Promise.all([
        apiCollection<Participant>('participants'),
        apiCollection<School>('schools'),
        apiCollection<Sponsor>('sponsors'),
      ])
      setParticipants(p)
      setSchools(sc)
      setSponsors(sp)
      toast.success('Data refreshed', {
        description: `Loaded ${p.length} participants, ${sc.length} schools, and ${sp.length} sponsors.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data'
      setError(msg)
      toast.error('Refresh failed', { description: msg })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      apiCollection<Participant>('participants'),
      apiCollection<School>('schools'),
      apiCollection<Sponsor>('sponsors'),
    ])
      .then(([p, sc, sp]) => {
        if (!active) return
        setParticipants(p)
        setSchools(sc)
        setSponsors(sp)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleLogout = async () => {
    await apiLogout()
    toast.success('Signed out', {
      description: 'You have been logged out of the admin panel.',
    })
    onLogout()
  }

  const totalKids =
    participants.length +
    schools.reduce((s, sc) => s + (sc.participants || 0), 0)

  const tabs: { id: Tab; label: string; count: number }[] = [
    {
      id: 'participants',
      label: 'Participants',
      count: participants.length,
    },
    {
      id: 'schools',
      label: 'Schools',
      count: schools.length,
    },
    {
      id: 'sponsors',
      label: 'Sponsors',
      count: sponsors.length,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <span className="text-base font-bold tracking-tight text-slate-900">
                FITKIDROX
              </span>
              <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                Admin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="admin-refresh-btn"
                onClick={() => void reload()}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                title="Refresh data"
              >
                <RefreshCw
                  size={13}
                  className={refreshing ? 'animate-spin' : ''}
                />
                Refresh
              </button>
              <button
                id="admin-logout-btn"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
              >
                <LogOut size={13} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-2">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
            <p className="text-sm">Loading records…</p>
          </div>
        ) : (
          <>
            {/* 4 Stats Cards (Clean Plain White) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Individual Participants
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {participants.length.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Direct online signups
                </div>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Registered Schools
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {schools.length.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  School bulk delegations
                </div>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Total Kids Enrolled
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {totalKids.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Individual + School rosters
                </div>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Sponsors
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {sponsors.length.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Corporate partners
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
              <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    id={`admin-tab-${t.id}`}
                    onClick={() => setTab(t.id)}
                    className={`whitespace-nowrap pb-3 px-1 border-b-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                      tab === t.id
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tab === t.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Panels */}
            <div>
              {tab === 'participants' && (
                <ParticipantsTable data={participants} />
              )}
              {tab === 'schools' && <SchoolsTable data={schools} />}
              {tab === 'sponsors' && <SponsorsTable data={sponsors} />}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 py-4 text-center text-xs text-slate-400 bg-white">
        FITKIDROX Admin · Read-only access
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Admin Page (Session Checker)
// ─────────────────────────────────────────────────────────────────────────────

function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    apiCheckSession()
      .then(setAuthed)
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm flex flex-col items-center gap-3">
          <RefreshCw size={24} className="animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Checking credentials…</p>
        </div>
      </div>
    )
  }

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />
  return <Dashboard onLogout={() => setAuthed(false)} />
}
