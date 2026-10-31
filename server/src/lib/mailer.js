import nodemailer from 'nodemailer'

/**
 * FITKIDROX Email Delivery Engine
 * Minimal, clean layout with simple highlighted text (no big bib div) and 6px border-radius everywhere.
 */

const DEFAULT_EVENT = {
  name: 'FITKIDROX Chandigarh 2026',
  dateLabel: '28–29 November 2026',
  venue: 'Sector 10D Skating Rink, Chandigarh',
  supportEmail: 'hello@fitkidrox.in',
  website: 'https://fitkidrox.in',
}

const SPONSOR_NAMES = {
  title: 'Title Sponsor',
  tshirt: 'T-shirt Sponsor',
  hydration: 'Hydration Sponsor',
  station: 'Obstacle Station Partner',
  associate: 'Associate Sponsor',
  community: 'Community Partner',
}

/**
 * Create or reuse nodemailer transport based on environment configuration.
 */
export function getMailTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT) || 587
  const secure =
    process.env.SMTP_SECURE === 'true' || String(port) === '465'
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''

  const isDispatchEnabled = process.env.EMAIL_DISPATCH_ENABLED === 'true'

  if (!isDispatchEnabled || !user || !pass) {
    const reason = !isDispatchEnabled
      ? 'Safe Mode (EMAIL_DISPATCH_ENABLED=false: no real network email sent)'
      : 'SMTP credentials missing'
    return {
      configured: Boolean(user && pass),
      dispatchEnabled: isDispatchEnabled,
      sendMail: async (options) => {
        console.warn(
          `[mailer] [${reason}] Allotment email prepared for: ${options.to} | Subject: "${options.subject}"`,
        )
        return {
          messageId: `simulated-${Date.now()}`,
          simulated: true,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }
      },
    }
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  })

  return {
    configured: true,
    dispatchEnabled: true,
    transporter,
    sendMail: transporter.sendMail.bind(transporter),
  }
}

function getSender() {
  return (
    process.env.SMTP_FROM ||
    `"FITKIDROX Chandigarh" <${process.env.SMTP_USER || 'hello@fitkidrox.in'}>`
  )
}

/**
 * Minimal template:
 * - Proper cell padding so content has comfortable breathing room in Gmail
 * - 6px border-radius everywhere as requested
 * - Simple highlighted text for identifiers instead of large boxed divs
 */
function renderMinimalTemplate({
  title,
  preheader,
  descriptionText,
  detailsRows = [],
  instructionsText,
}) {
  const detailsHtml =
    detailsRows.length > 0
      ? `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 24px 0; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; font-size: 13px;">
          ${detailsRows
            .map(
              (r, i) => `
            <tr style="background-color: ${i % 2 === 0 ? '#FFFFFF' : '#FAFAFA'};">
              <td style="padding: 11px 16px; color: #6B7280; border-bottom: 1px solid #E5E7EB; width: 40%;">${r.label}</td>
              <td style="padding: 11px 16px; color: #111827; font-weight: 500; border-bottom: 1px solid #E5E7EB; text-align: right;">${r.value}</td>
            </tr>`,
            )
            .join('')}
        </table>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F1F5F9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    @media only screen and (max-width: 600px) {
      .email-cell { padding: 24px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0; font-size: 1px; color: #F1F5F9;">
    ${preheader || title}
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F1F5F9; padding: 40px 16px;">
    <tr>
      <td align="center" valign="top">
        
        <!-- Outer Card (6px border-radius) -->
        <div style="max-width: 580px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <!-- Generous padding directly on TD for bulletproof Gmail spacing -->
              <td class="email-cell" style="padding: 36px 32px; text-align: left;">

                <!-- Header Branding -->
                <div style="padding-bottom: 20px; border-bottom: 1px solid #F3F4F6;">
                  <div style="font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #111827;">
                    FIT<span style="color: #EA580C;">KID</span>ROX
                  </div>
                  <div style="font-size: 12px; color: #6B7280; margin-top: 2px;">
                    Chandigarh 2026 &middot; Sector 10D Skating Rink
                  </div>
                </div>

                <!-- Title -->
                <h1 style="margin: 24px 0 10px 0; font-size: 21px; font-weight: 700; color: #111827; line-height: 1.3;">
                  ${title}
                </h1>

                <!-- Description -->
                <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 1.6; color: #4B5563;">
                  ${descriptionText}
                </p>

                <!-- Details Rows (includes highlighted Bib / Reference) -->
                ${detailsHtml}

                <!-- Instructions / Reminder Box (6px border-radius) -->
                ${
                  instructionsText
                    ? `<div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 15px 18px; margin-bottom: 24px; font-size: 13px; color: #4B5563; line-height: 1.6;">
                    ${instructionsText}
                  </div>`
                    : ''
                }

                <!-- Action Button (6px border-radius) -->
                <div style="margin-bottom: 28px; text-align: center;">
                  <a href="${DEFAULT_EVENT.website}" style="display: inline-block; background-color: #111827; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 11px 24px; border-radius: 6px; letter-spacing: 0.3px;">
                    Visit fitkidrox.in
                  </a>
                </div>

                <!-- Footer -->
                <div style="border-top: 1px solid #F3F4F6; padding-top: 20px; text-align: center; font-size: 11px; color: #9CA3AF; line-height: 1.6;">
                  <p style="margin: 0 0 4px 0;">FITKIDROX Chandigarh 2026 &middot; 28–29 November 2026</p>
                  <p style="margin: 0;">Sector 10D Skating Rink, Chandigarh &middot; <a href="mailto:${DEFAULT_EVENT.supportEmail}" style="color: #6B7280; text-decoration: underline;">${DEFAULT_EVENT.supportEmail}</a></p>
                </div>

              </td>
            </tr>
          </table>
        </div>

      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Builds the complete Allotment Confirmation Email content (HTML and plain text).
 * Reusable for actual dispatch as well as on-demand previewing in the admin panel.
 */
export function buildParticipantAllotmentEmail({
  participant,
  bibNumber,
  heat,
  course,
}) {
  const recipient = participant.guardianEmail || ''
  const assignedBib = bibNumber || participant.bibNumber || 'Pending'
  const assignedHeat = heat || participant.heat || 1
  const assignedCourse =
    course || participant.course || (assignedHeat % 2 !== 0 ? 'Course A' : 'Course B')

  const childFirst = participant.childName?.trim()
    ? participant.childName.trim().split(' ')[0]
    : 'Athlete'

  const amountPaid = Number(participant.payment?.amount ?? 1250).toLocaleString('en-IN')

  const title = `Allotment Confirmed, ${childFirst}`
  const preheader = `Your payment was successfully confirmed! Official Slot & Bib Allotment Confirmed for ${participant.childName || 'Athlete'}. Bib #${assignedBib}, Heat ${assignedHeat}, ${assignedCourse}.`
  const subject = `Successful Allotment Confirmed: ${participant.childName || 'Athlete'} (Bib #${assignedBib})`

  const descriptionText = `Your payment of <strong>₹${amountPaid}</strong> was successfully confirmed, and ${childFirst}’s spot in <strong>${participant.category || 'FITKIDROX'}</strong> has been officially allotted. Please find your assigned Bib Number, Heat, and Course details below. Present your Bib Number at the athlete check-in desk on race day.`

  // Bib number presented as simple highlighted text
  const bibHighlightedText = `<span style="display: inline-block; font-size: 15px; font-weight: 700; color: #111827; background-color: #F1F5F9; border: 1px solid #E2E8F0; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">#${assignedBib}</span>`

  const heatCourseHighlightedText = `<span style="display: inline-block; font-size: 13px; font-weight: 600; color: #0369A1; background-color: #E0F2FE; border: 1px solid #BAE6FD; padding: 1px 7px; border-radius: 4px;">Heat ${assignedHeat}</span> &nbsp;&middot;&nbsp; <span style="display: inline-block; font-size: 13px; font-weight: 600; color: #047857; background-color: #D1FAE5; border: 1px solid #A7F3D0; padding: 1px 7px; border-radius: 4px;">${assignedCourse}</span>`

  const paymentConfirmedPill = `<span style="display: inline-block; font-size: 13px; font-weight: 600; color: #047857; background-color: #D1FAE5; border: 1px solid #A7F3D0; padding: 1px 7px; border-radius: 4px;">✓ Payment Confirmed</span>`

  const detailsRows = [
    { label: 'Bib Number (ID)', value: bibHighlightedText },
    { label: 'Assigned Heat & Course', value: heatCourseHighlightedText },
    { label: 'Athlete Name', value: participant.childName },
    { label: 'Category', value: participant.category },
    { label: 'Date of Birth', value: `${participant.dob || '—'} (${participant.gender || '—'})` },
    { label: 'T-Shirt Size', value: participant.tshirt || '—' },
    { label: 'School / Team', value: participant.school || 'Individual Entry' },
    { label: 'Parent / Guardian', value: `${participant.guardianName || '—'} (+91 ${participant.guardianPhone || '—'})` },
    { label: 'Payment Status', value: paymentConfirmedPill },
    { label: 'Amount Paid', value: `₹${amountPaid} (Paid)` },
    { label: 'Event Dates', value: DEFAULT_EVENT.dateLabel },
    { label: 'Venue', value: DEFAULT_EVENT.venue },
  ]

  const instructionsText = `
    <strong>Race Day Reminder:</strong> Please arrive at Sector 10D Skating Rink, Chandigarh 45 minutes before Heat ${assignedHeat}. Present your <strong>Bib Number (#${assignedBib})</strong> at check-in to collect your timing chip and athlete kit.
  `

  const text = `
Allotment Confirmed, ${childFirst}!

Your payment of ₹${amountPaid} was successfully confirmed.
${childFirst}’s spot in ${participant.category || 'FITKIDROX'} is officially confirmed and allotted.

Bib Number: #${assignedBib}
Assigned Heat & Course: Heat ${assignedHeat} (${assignedCourse})
Category: ${participant.category}
Payment Status: Successfully Confirmed (₹${amountPaid} Paid)
Amount Paid: ₹${amountPaid} (Paid)

Dates: ${DEFAULT_EVENT.dateLabel}
Venue: ${DEFAULT_EVENT.venue}

Please arrive 45 minutes before your heat with your Bib Number.
Visit: ${DEFAULT_EVENT.website}
`

  const html = renderMinimalTemplate({
    title,
    preheader,
    descriptionText,
    detailsRows,
    instructionsText,
  })

  return {
    recipient,
    subject,
    title,
    preheader,
    descriptionText,
    detailsRows,
    instructionsText,
    text,
    html,
    bibNumber: assignedBib,
    heat: assignedHeat,
    course: assignedCourse,
  }
}

/**
 * 1. Participant Confirmation & Allotment Email
 * Bib number presented in simple highlighted text, not overly bold, with 6px border-radius everywhere.
 */
export async function sendParticipantConfirmationEmail({
  participant,
  bibNumber,
  heat,
  course,
}) {
  const mailData = buildParticipantAllotmentEmail({
    participant,
    bibNumber,
    heat,
    course,
  })

  const recipient = mailData.recipient
  if (!recipient) {
    console.warn('[mailer] Cannot send participant email: guardianEmail is missing.')
    return {
      skipped: true,
      reason: 'missing_email',
      ...mailData,
    }
  }

  const mailer = getMailTransporter()
  const info = await mailer.sendMail({
    from: getSender(),
    to: recipient,
    subject: mailData.subject,
    text: mailData.text,
    html: mailData.html,
  })

  console.log(`[mailer] Participant allotment email processed for ${recipient} (messageId: ${info.messageId})`)
  return {
    ...info,
    to: recipient,
    subject: mailData.subject,
    text: mailData.text,
    html: mailData.html,
    bibNumber: mailData.bibNumber,
    heat: mailData.heat,
    course: mailData.course,
  }
}

/**
 * 2. School Confirmation Email
 * Simple highlighted reference code with 6px border-radius everywhere.
 */
export async function sendSchoolConfirmationEmail({ school }) {
  const recipient = school.email
  if (!recipient) {
    console.warn('[mailer] Cannot send school email: email is missing.')
    return { skipped: true, reason: 'missing_email' }
  }

  const approxCount =
    school.participants ||
    (Array.isArray(school.roster) ? school.roster.length : 0)

  const title = `${school.schoolName} is registered`
  const preheader = `Participation request received for ${school.schoolName} (~${approxCount} students). Reference: ${school.reference}.`

  const descriptionText = `Thank you. We have received your participation request for approximately <strong>${approxCount} students</strong>. Our school partnerships team will contact <strong>${school.coordinator}</strong> within two working days with event slots and coordinator credentials.`

  const refHighlightedText = `<span style="display: inline-block; font-size: 14px; font-weight: 700; color: #111827; background-color: #F1F5F9; border: 1px solid #E2E8F0; padding: 2px 8px; border-radius: 4px;">${school.reference}</span>`

  const detailsRows = [
    { label: 'Reference Code', value: refHighlightedText },
    { label: 'School Name', value: school.schoolName },
    { label: 'City', value: school.city },
    { label: 'Coordinator', value: school.coordinator },
    { label: 'Phone', value: `+91 ${school.phone}` },
    { label: 'Estimated Delegation', value: `${approxCount} students` },
    { label: 'Event Dates', value: DEFAULT_EVENT.dateLabel },
    { label: 'Venue', value: DEFAULT_EVENT.venue },
  ]

  const instructionsText = `
    <strong>Next Steps:</strong> Our team will share the student roster spreadsheet and briefing packet with ${school.coordinator}. A dedicated school check-in counter will be available on race morning.
  `

  const text = `
${school.schoolName} is registered!

Thank you. We have received your participation request for approximately ${approxCount} students.
Reference Code: ${school.reference}

School: ${school.schoolName}
City: ${school.city}
Coordinator: ${school.coordinator} (+91 ${school.phone})
Delegation Size: ~${approxCount} students

Dates: ${DEFAULT_EVENT.dateLabel}
Venue: ${DEFAULT_EVENT.venue}

Visit: ${DEFAULT_EVENT.website}
`

  const html = renderMinimalTemplate({
    title,
    preheader,
    descriptionText,
    detailsRows,
    instructionsText,
  })

  const mailer = getMailTransporter()
  const info = await mailer.sendMail({
    from: getSender(),
    to: recipient,
    subject: `School registered: ${school.schoolName} (${school.reference})`,
    text,
    html,
  })

  console.log(`[mailer] School email dispatched to ${recipient} (messageId: ${info.messageId})`)
  return info
}

/**
 * 3. Sponsor Confirmation Email
 * Simple highlighted reference code with 6px border-radius everywhere.
 */
export async function sendSponsorConfirmationEmail({ sponsor }) {
  const recipient = sponsor.email
  if (!recipient) {
    console.warn('[mailer] Cannot send sponsor email: email is missing.')
    return { skipped: true, reason: 'missing_email' }
  }

  const packageName =
    SPONSOR_NAMES[sponsor.packageId] || sponsor.packageId || 'Corporate Partner'

  const title = `Thank you, ${sponsor.company}`
  const preheader = `Sponsorship enquiry received for ${sponsor.company} (${packageName}). Reference: ${sponsor.reference}.`

  const descriptionText = `We have received your sponsorship enquiry for the <strong>${packageName}</strong> tier. Our brand partnerships team will review your requirements and follow up with <strong>${sponsor.contact}</strong> within two working days.`

  const refHighlightedText = `<span style="display: inline-block; font-size: 14px; font-weight: 700; color: #111827; background-color: #F1F5F9; border: 1px solid #E2E8F0; padding: 2px 8px; border-radius: 4px;">${sponsor.reference}</span>`

  const detailsRows = [
    { label: 'Reference Code', value: refHighlightedText },
    { label: 'Company / Brand', value: sponsor.company },
    { label: 'Selected Package', value: packageName },
    { label: 'Contact Person', value: sponsor.contact },
    { label: 'Phone', value: sponsor.phone ? `+91 ${sponsor.phone}` : 'Not provided' },
    { label: 'Event Dates', value: DEFAULT_EVENT.dateLabel },
    { label: 'Venue', value: DEFAULT_EVENT.venue },
  ]

  if (sponsor.message) {
    detailsRows.push({ label: 'Notes', value: sponsor.message })
  }

  const instructionsText = `
    <strong>Next Steps:</strong> Our partnerships director will connect to share the complete brand activation deck, logo placement guidelines, and expo stall allocations.
  `

  const text = `
Thank you, ${sponsor.company}!

We have received your sponsorship enquiry for the ${packageName} tier.
Reference Code: ${sponsor.reference}

Company: ${sponsor.company}
Package: ${packageName}
Contact: ${sponsor.contact} (${sponsor.email})

Dates: ${DEFAULT_EVENT.dateLabel}
Venue: ${DEFAULT_EVENT.venue}

Visit: ${DEFAULT_EVENT.website}
`

  const html = renderMinimalTemplate({
    title,
    preheader,
    descriptionText,
    detailsRows,
    instructionsText,
  })

  const mailer = getMailTransporter()
  const info = await mailer.sendMail({
    from: getSender(),
    to: recipient,
    subject: `Partnership inquiry: ${sponsor.company} (${sponsor.reference})`,
    text,
    html,
  })

  console.log(`[mailer] Sponsor email dispatched to ${recipient} (messageId: ${info.messageId})`)
  return info
}
