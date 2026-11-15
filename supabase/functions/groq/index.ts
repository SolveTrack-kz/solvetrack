// SolveTrack — посредник между сайтом и ИИ (Supabase Edge Function, имя: groq).
// Основной ИИ — Google Gemini (секрет GEMINI_API_KEY), запасной — Groq (секрет GROQ_API_KEY, необязательно).
// Ключи хранятся только в секретах Supabase и не попадают в браузер.
// Запросы принимаются только от вошедших учеников.
//
// Как развернуть: Supabase → Edge Functions → Deploy a new function → Via Editor,
// имя функции: groq, вставить этот файл, выключить "Verify JWT" (проверка делается ниже), Deploy.
// Затем Edge Functions → Secrets: GEMINI_API_KEY = ключ из aistudio.google.com
// (и по желанию GROQ_API_KEY = ключ из console.groq.com как запасной).

const PROVIDERS = {
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    secret: "GEMINI_API_KEY",
    models: ["gemini-3.8-flash", "gemini-3.6-flash"],
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    secret: "GROQ_API_KEY",
    models: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "meta-models/muse-spark-open"],
  },
} as const;
const MAX_BODY = 4_000_000; // ~4 МБ: хватает на фото решения

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: { message: "Only POST" } }, 405);

  // Проверяем, что запрос пришёл от вошедшего пользователя
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!auth.startsWith("Bearer ") || !apikey || !supabaseUrl) {
    return json({ error: { message: "Sign in required", code: "auth_required" } }, 401);
  }
  const who = await fetch(supabaseUrl + "/auth/v1/user", { headers: { Authorization: auth, apikey } });
  if (!who.ok) return json({ error: { message: "Sign in required", code: "auth_required" } }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: { message: "Request too large" } }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: { message: "Invalid JSON" } }, 400);
  }

  const model = String(body.model);
  const provider = (Object.values(PROVIDERS) as typeof PROVIDERS[keyof typeof PROVIDERS][])
    .find((p) => (p.models as readonly string[]).includes(model));
  if (!provider) return json({ error: { message: "Model not allowed", code: "model_not_found" } }, 404);

  const key = Deno.env.get(provider.secret);
  if (!key) return json({ error: { message: provider.secret + " secret is not set" } }, 500);

  body.stream = false;
  if (provider === PROVIDERS.gemini) {
    // Gemini (OpenAI-совместимый режим): лимит ответа включает «размышления» модели
    body.max_tokens = Math.min(Number(body.max_completion_tokens) || 2000, 4000);
    delete body.max_completion_tokens;
    delete body.response_format;
    if (!body.reasoning_effort) body.reasoning_effort = "low";
  } else {
    body.max_completion_tokens = Math.min(Number(body.max_completion_tokens) || 700, 1500);
  }

  const upstream = await fetch(provider.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
