// Supabase Edge Function: daily-quiz-generator
// Deno runtime. Paste into the Supabase Dashboard function editor and deploy.
//
// Features:
// - CORS
// - Indian date (IST)
// - Provider switch: OpenAI (ready), Anthropic Claude (ready), Grok (TODO)
// - GET/POST params: provider, topic, count
// - Optional caching to "daily_quizzes" (date unique) if SUPABASE_* env vars present

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type Difficulty = "easy" | "medium" | "hard";
interface DailyQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number; // 0..3
  explanation: string;
  subject: string;
  subtopic: string;
  difficulty: Difficulty;
  points: number;
  exam_relevance?: string;
}

// ---- MAIN HANDLER ----
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ---- date in IST ----
    const indianTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const today = new Date(indianTime).toISOString().split("T")[0];

    // ---- URL/Body params ----
    const url = new URL(req.url);
    const provider = (url.searchParams.get("provider") || Deno.env.get("AI_PROVIDER") || "openai").toLowerCase();
    let topic = url.searchParams.get("topic") || undefined;

    let count = Number(url.searchParams.get("count") || 10);
    if (!Number.isFinite(count)) count = 10;
    count = Math.max(1, Math.min(20, count)); // clamp 1..20

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.topic && !topic) topic = String(body.topic);
        if (Number.isFinite(body?.count)) {
          count = Math.max(1, Math.min(20, Number(body.count)));
        }
      } catch {
        // ignore invalid JSON
      }
    }

    // ---- optional Supabase for caching ----
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase =
      supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
        : null;

    // If we have DB access, try returning cached quiz first
    if (supabase) {
      const { data: existing, error: exErr } = await supabase
        .from("daily_quizzes")
        .select("date, questions")
        .eq("date", today)
        .single();

      if (!exErr && existing?.questions) {
        return json200({ date: existing.date, provider: "cache", count: existing.questions.length, questions: existing.questions });
      }
      // else: no cache, proceed to generate
    }

    // ---- generate via provider ----
    let questions: DailyQuizQuestion[] = [];
    if (provider === "openai") {
      questions = await generateQuizViaOpenAI(count, topic);
    } else if (provider === "claude") {
      questions = await generateQuizViaClaude(count, topic);
    } else if (provider === "grok") {
      // TODO: wire Grok if you have xAI access; leave stub for now
      throw new Error("Grok provider not wired yet. Use provider=openai or provider=claude.");
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // ---- optional: cache today's quiz ----
    if (supabase) {
      // Requires a table:
      // create table if not exists daily_quizzes (
      //   id uuid primary key default gen_random_uuid(),
      //   date date unique not null,
      //   questions jsonb not null,
      //   created_at timestamptz not null default now()
      // );
      await supabase
        .from("daily_quizzes")
        .upsert({ date: today, questions }, { onConflict: "date" });
    }

    return json200({ date: today, provider, count: questions.length, questions });
  } catch (err) {
    console.error("daily-quiz-generator error", err);
    return json500({ error: String(err) });
  }
});

/* -------------------- PROVIDERS -------------------- */

async function generateQuizViaOpenAI(count = 10, topic?: string): Promise<DailyQuizQuestion[]> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const sys = "You are a strict JSON-only MCQ generator for Indian competitive exams (UPSC/SSC/TNPSC/etc).";
  const user = [
    `Generate ${count} multiple-choice questions${topic ? ` on topic: ${topic}` : ""}.`,
    "Constraints:",
    "- Exactly 4 options per question.",
    "- correct_answer is the index 0..3.",
    "- difficulty is one of: easy, medium, hard.",
    "- points is an integer (default 10).",
    "- Include subject and subtopic.",
    "- exam_relevance like UPSC/SSC/TNPSC/etc.",
    "Return strictly a JSON array of objects with keys:",
    '["id","question","options","correct_answer","explanation","subject","subtopic","difficulty","points","exam_relevance"]',
  ].join("\n");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini", // pick your model
      temperature: 0.4,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "[]";
  const json = safeJsonParseArray(content);
  return normalizeQuestions(json);
}

async function generateQuizViaClaude(count = 10, topic?: string): Promise<DailyQuizQuestion[]> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const sys = "You are a strict JSON-only MCQ generator for Indian competitive exams (UPSC/SSC/TNPSC/etc).";
  const user = [
    `Generate ${count} multiple-choice questions${topic ? ` on topic: ${topic}` : ""}.`,
    "Constraints:",
    "- Exactly 4 options per question.",
    "- correct_answer is the index 0..3.",
    "- difficulty is one of: easy, medium, hard.",
    "- points is an integer (default 10).",
    "- Include subject and subtopic.",
    "- exam_relevance like UPSC/SSC/TNPSC/etc.",
    "Return strictly a JSON array of objects with keys:",
    '["id","question","options","correct_answer","explanation","subject","subtopic","difficulty","points","exam_relevance"]',
  ].join("\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest", // adjust to your plan
      max_tokens: 2000,
      temperature: 0.4,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic error: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  // Claude returns content as an array of blocks; grab text from the first text block
  const textBlock = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === "text") : null;
  const content = String(textBlock?.text || "[]").trim();
  const json = safeJsonParseArray(content);
  return normalizeQuestions(json);
}

/* -------------------- HELPERS -------------------- */

function safeJsonParseArray(text: string): any[] {
  // Strip ```json fences if present
  const stripped = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeQuestions(raw: any[]): DailyQuizQuestion[] {
  return raw.map((q: any) => ({
    id: String(q?.id ?? cryptoRandomId()),
    question: String(q?.question ?? ""),
    options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o)) : [],
    correct_answer: Number.isFinite(q?.correct_answer) ? Number(q.correct_answer) : 0,
    explanation: String(q?.explanation ?? ""),
    subject: String(q?.subject ?? "General"),
    subtopic: String(q?.subtopic ?? "Misc"),
    difficulty: (["easy", "medium", "hard"].includes(q?.difficulty) ? q.difficulty : "medium") as Difficulty,
    points: Number.isFinite(q?.points) ? Number(q.points) : 10,
    exam_relevance: q?.exam_relevance ? String(q.exam_relevance) : undefined,
  }));
}

function cryptoRandomId() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function json200(obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function json500(obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
