import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "@supabase/supabase-js";

type StudentPayload = {
  consultancyId?: string;
  fullName?: string;
  email?: string;
  password?: string;
  whatsapp?: string;
  age?: number | null;
  sex?: "male" | "female" | "other";
  heightCm?: number | null;
  weightKg?: number | null;
  goal?: "hypertrophy" | "fat_loss" | "recomposition" | "health" | "performance";
  activityLevel?: "sedentary" | "light" | "moderate" | "active" | "very_active";
  experience?: "beginner" | "intermediate" | "advanced";
  restrictions?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedSexes = new Set(["male", "female", "other"]);
const allowedGoals = new Set(["hypertrophy", "fat_loss", "recomposition", "health", "performance"]);
const allowedActivityLevels = new Set(["sedentary", "light", "moderate", "active", "very_active"]);
const allowedExperiences = new Set(["beginner", "intermediate", "advanced"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string | undefined>;
      if (parsed.default) {
        return parsed.default;
      }
    } catch {
      return secretKeys;
    }
  }

  return (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    ""
  );
}

function getPublishableKey() {
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

  if (publishableKeys) {
    try {
      const parsed = JSON.parse(publishableKeys) as Record<string, string | undefined>;
      if (parsed.default) {
        return parsed.default;
      }
    } catch {
      return publishableKeys;
    }
  }

  return Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned.length ? cleaned : null;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function validatePayload(payload: StudentPayload) {
  const fullName = cleanText(payload.fullName);
  const email = cleanText(payload.email).toLowerCase();
  const password = cleanText(payload.password);
  const age = normalizeNumber(payload.age);
  const heightCm = normalizeNumber(payload.heightCm);
  const weightKg = normalizeNumber(payload.weightKg);
  const sex = payload.sex ?? "other";
  const goal = payload.goal ?? "hypertrophy";
  const activityLevel = payload.activityLevel ?? "moderate";
  const experience = payload.experience ?? "beginner";

  if (fullName.length < 2) {
    return { error: "Informe o nome completo do aluno." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido para o aluno." };
  }

  if (password.length < 6) {
    return { error: "A senha provisória precisa ter pelo menos 6 caracteres." };
  }

  if (!payload.consultancyId) {
    return { error: "Consultoria não encontrada para criar o aluno." };
  }

  if (age !== null && (age < 5 || age > 120)) {
    return { error: "Informe uma idade válida." };
  }

  if (heightCm !== null && (heightCm < 80 || heightCm > 250)) {
    return { error: "Informe uma altura válida em centímetros." };
  }

  if (weightKg !== null && (weightKg < 20 || weightKg > 400)) {
    return { error: "Informe um peso válido em kg." };
  }

  if (!allowedSexes.has(sex)) {
    return { error: "Sexo inválido." };
  }

  if (!allowedGoals.has(goal)) {
    return { error: "Objetivo inválido." };
  }

  if (!allowedActivityLevels.has(activityLevel)) {
    return { error: "Nível de atividade inválido." };
  }

  if (!allowedExperiences.has(experience)) {
    return { error: "Experiência inválida." };
  }

  return {
    value: {
      consultancyId: payload.consultancyId,
      fullName,
      email,
      password,
      whatsapp: optionalText(payload.whatsapp),
      age,
      sex,
      heightCm,
      weightKg,
      goal,
      activityLevel,
      experience,
      restrictions: optionalText(payload.restrictions),
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = getPublishableKey();
  const secretKey = getSecretKey();
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return jsonResponse({ error: "Supabase não está configurado na Edge Function." }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let authUserId: string | null = null;

  try {
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Entre como treinador para criar alunos." }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "trainer") {
      return jsonResponse({ error: "Apenas treinadores podem criar alunos." }, 403);
    }

    let payload: StudentPayload;

    payload = await req.json();

    const validated = validatePayload(payload);

    if ("error" in validated) {
      return jsonResponse({ error: validated.error }, 400);
    }

    const input = validated.value;

    const { data: consultancy, error: consultancyError } = await adminClient
      .from("consultancies")
      .select("id, trainer_id")
      .eq("id", input.consultancyId)
      .eq("trainer_id", user.id)
      .maybeSingle();

    if (consultancyError || !consultancy) {
      return jsonResponse({ error: "Consultoria não encontrada para este treinador." }, 404);
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: {
        role: "student",
      },
      user_metadata: {
        full_name: input.fullName,
      },
    });

    if (authError || !authData.user) {
      return jsonResponse(
        { error: authError?.message ?? "Não foi possível criar o acesso do aluno." },
        400,
      );
    }

    authUserId = authData.user.id;

    await adminClient
      .from("profiles")
      .upsert(
        {
          id: authUserId,
          role: "student",
          full_name: input.fullName,
        },
        { onConflict: "id" },
      );

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .insert({
        trainer_id: user.id,
        consultancy_id: consultancy.id,
        auth_user_id: authUserId,
        full_name: input.fullName,
        display_name: input.fullName,
        email: input.email,
        whatsapp: input.whatsapp,
        age: input.age,
        sex: input.sex,
        height_cm: input.heightCm,
        weight_kg: input.weightKg,
        goal: input.goal,
        activity_level: input.activityLevel,
        experience: input.experience,
        restrictions: input.restrictions,
      })
      .select(
        "id, trainer_id, consultancy_id, auth_user_id, full_name, email, whatsapp, age, sex, height_cm, weight_kg, goal, activity_level, experience, restrictions, display_name, username, headline, bio, location, instagram_url, website_url, avatar_path, avatar_url, cover_path, cover_url, status, created_at, updated_at",
      )
      .single();

    if (studentError) {
      throw studentError;
    }

    return jsonResponse({ student: { ...student, notifications_count: 0 } });
  } catch (error) {
    if (authUserId) {
      await adminClient.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }

    const message = error instanceof Error ? error.message : "Não foi possível salvar o aluno.";
    return jsonResponse({ error: message }, 400);
  }
});
