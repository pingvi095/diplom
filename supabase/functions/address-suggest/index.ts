import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

type DadataSuggestion = {
  value?: string
  unrestricted_value?: string
  data?: {
    geo_lat?: string | null
    geo_lon?: string | null
    city?: string | null
    settlement?: string | null
    region_with_type?: string | null
    street_with_type?: string | null
    house?: string | null
  }
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
  const dadataApiKey = Deno.env.get('DADATA_API_KEY')

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceRoleKey ||
    !dadataApiKey
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
      { error: 'Подсказки адреса доступны только организатору и админу' },
      403
    )
  }

  const body = await req.json().catch(() => null)
  const query = typeof body?.query === 'string' ? body.query.trim() : ''

  if (query.length < 3) {
    return json({ suggestions: [] })
  }

  const response = await fetch(
    'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${dadataApiKey}`,
      },
      body: JSON.stringify({
        query,
        count: 6,
      }),
    }
  )

  if (!response.ok) {
    return json(
      { error: 'Не удалось получить подсказки адреса' },
      response.status
    )
  }

  const result = await response.json()

  const suggestions = ((result.suggestions || []) as DadataSuggestion[]).map(
    (item) => {
      const latitude = item.data?.geo_lat ? Number(item.data.geo_lat) : null
      const longitude = item.data?.geo_lon ? Number(item.data.geo_lon) : null

      return {
        value: item.value || '',
        unrestrictedValue: item.unrestricted_value || item.value || '',
        city: item.data?.city || item.data?.settlement || null,
        region: item.data?.region_with_type || null,
        street: item.data?.street_with_type || null,
        house: item.data?.house || null,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
      }
    }
  )

  return json({ suggestions })
})