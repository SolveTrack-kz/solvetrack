// SolveTrack — посредник между сайтом и Groq (Supabase Edge Function).
// Ключ Groq хранится в секрете GROQ_API_KEY и не попадает в браузер.
// Запросы принимаются только от вошедших учеников.
//
// Как развернуть: Supabase → Edge Functions → Deploy a new function → Via Editor,
// имя функции: groq, вставить этот файл, выключить "Verify JWT" (проверка делается ниже), Deploy.
// Затем Edge Functions → Secrets → Add new secret: GROQ_API_KEY = ваш ключ gsk_...

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const ALLOWED_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "meta-models/muse-spark-open",
];
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

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return json({ error: { message: "GROQ_API_KEY secret is not set" } }, 500);

  // Проверяем, что запрос пришёл от вошедшего пользователя
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!auth.startsWith("Bearer ") || !apikey || !supabaseUrl) {
    return json({ error: { message: "Sign in required", code: "auth_required" } }, 401);
  }
  const who = await fetch(supabaseUrl + "/auth/v1/user", {
    headers: { Authorization: auth, apikey },
  });
  if (!who.ok) return json({ error: { message: "Sign in required", code: "auth_required" } }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: { message: "Request too large" } }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: { message: "Invalid JSON" } }, 400);
  }

  if (!ALLOWED_MODELS.includes(String(body.model))) {
    return json({ error: { message: "Model not allowed", code: "model_not_found" } }, 404);
  }
  body.max_completion_tokens = Math.min(Number(body.max_completion_tokens) || 700, 1500);
  body.stream = false;

  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
