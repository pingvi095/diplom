import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const formatDateForEmail = (value: string | null | undefined) => {
  if (!value) return ''

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) return value

  return `${match[3]}.${match[2]}.${match[1]}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Метод не поддерживается' }, 405)
  }

  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return json({ error: 'Нужно войти' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL')

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceRoleKey ||
    !resendApiKey ||
    !resendFromEmail
  ) {
    return json({ error: 'Не настроены переменные окружения функции' }, 500)
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return json({ error: 'Нужно войти' }, 401)
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return json({ error: profileError.message }, 400)
  }

  if (!profile || !['organizer', 'admin'].includes(profile.role)) {
    return json(
      { error: 'Отправлять приглашения могут только организатор и админ' },
      403
    )
  }

  const body = await req.json().catch(() => null)

  const eventId = typeof body?.eventId === 'string' ? body.eventId : ''
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  const rawEmails: unknown[] = Array.isArray(body?.emails) ? body.emails : []

  const emails: string[] = Array.from(
    new Set(
      rawEmails
        .filter((email: unknown): email is string => typeof email === 'string')
        .map((email: string) => normalizeEmail(email))
        .filter((email: string) => email.length > 0)
    )
  )

  if (!eventId) {
    return json({ error: 'Выбери мероприятие' }, 400)
  }

  if (emails.length === 0) {
    return json({ error: 'Введи хотя бы один email' }, 400)
  }

  const invalidEmails = emails.filter((email) => !emailRegex.test(email))

  if (invalidEmails.length > 0) {
    return json(
      { error: `Некорректные email: ${invalidEmails.join(', ')}` },
      400
    )
  }

  const { data: event, error: eventError } = await adminClient
    .from('events')
    .select('id, title, date, location')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) {
    return json({ error: eventError.message }, 400)
  }

  if (!event) {
    return json({ error: 'Мероприятие не найдено' }, 404)
  }

  const payload = emails.map((email) => ({
    sender_id: user.id,
    event_id: eventId,
    recipient_email: email,
    message: message || null,
    status: 'sent',
  }))

  const { error: insertError } = await adminClient
    .from('invitations')
    .insert(payload)

  if (insertError) {
    return json({ error: insertError.message }, 400)
  }

  const emailText = [
    `Вас пригласили на мероприятие «${event.title}».`,
    event.date ? `Дата: ${formatDateForEmail(event.date)}` : '',
    event.location ? `Место: ${event.location}` : '',
    message ? `Сообщение: ${message}` : '',
    '',
    'Чтобы принять или отклонить приглашение, войдите или зарегистрируйтесь в приложении с этим же email.',
  ]
    .filter(Boolean)
    .join('\n')

  const results = await Promise.all(
    emails.map(async (email: string) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: email,
          subject: `Приглашение на ${event.title}`,
          text: emailText,
        }),
      })

      return {
        email,
        ok: response.ok,
      }
    })
  )

  const failedEmails = results
    .filter((result) => !result.ok)
    .map((result) => result.email)

  return json({
    ok: failedEmails.length === 0,
    createdCount: payload.length,
    sentCount: emails.length - failedEmails.length,
    failedEmails,
  })
})