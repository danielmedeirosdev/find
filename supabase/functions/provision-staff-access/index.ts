import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsFor } from "./_shared/cors.ts";

function json(corsHeaders: HeadersInit, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uuidLike(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function isDuplicateEmailError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /already\s+(been\s+)?registered|already\s+exists|email.?exists|duplicate|user_already_exists/i
    .test(message);
}

/** Exact email → auth.users.id via SECURITY DEFINER RPC (no listUsers pagination). */
async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc("auth_user_id_by_email", {
    p_email: email,
  });
  if (error) {
    console.error("auth_user_id_by_email failed", error.message);
    return null;
  }
  return typeof data === "string" && uuidLike(data) ? data : null;
}

async function assertLinkableStaffUser(
  admin: SupabaseClient,
  userId: string,
  barberId: string,
): Promise<string | null> {
  const { data: ownedShop } = await admin
    .from("shops")
    .select("id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (ownedShop) {
    return "Este e-mail já é dono de um estabelecimento e não pode ser usado como profissional.";
  }

  const { data: otherLink } = await admin
    .from("barbers")
    .select("id")
    .eq("user_id", userId)
    .neq("id", barberId)
    .maybeSingle();
  if (otherLink) {
    return "Este e-mail já está vinculado a outro profissional.";
  }

  return null;
}

Deno.serve(async (req) => {
  const { allowed, headers: corsHeaders } = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!allowed) {
    return json(corsHeaders, { error: "Origem não permitida" }, 403);
  }
  if (req.method !== "POST") {
    return json(corsHeaders, { error: "Método não permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(corsHeaders, { error: "Configuração do servidor incompleta" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(corsHeaders, { error: "Não autenticado" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json(corsHeaders, { error: "Sessão inválida" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(corsHeaders, { error: "JSON inválido" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "provision";
  const barberId = body.barber_id;
  if (!uuidLike(barberId)) {
    return json(corsHeaders, { error: "Profissional inválido" }, 400);
  }

  const { data: barber, error: barberError } = await admin
    .from("barbers")
    .select("id, shop_id, name, user_id")
    .eq("id", barberId)
    .maybeSingle();

  if (barberError || !barber) {
    return json(corsHeaders, { error: "Profissional não encontrado" }, 404);
  }

  const { data: shop } = await admin
    .from("shops")
    .select("id, owner_user_id, name")
    .eq("id", barber.shop_id)
    .maybeSingle();

  // Owner of THIS shop only — blocks cross-tenant and staff self-provision.
  if (!shop || shop.owner_user_id !== user.id) {
    return json(corsHeaders, { error: "Sem permissão para gerenciar este profissional" }, 403);
  }

  if (action === "revoke") {
    if (!barber.user_id) {
      return json(corsHeaders, {
        ok: true,
        revoked: false,
        message: "Este profissional já não tinha acesso.",
      });
    }
    const { error: unlinkError } = await admin
      .from("barbers")
      .update({ user_id: null })
      .eq("id", barber.id);
    if (unlinkError) {
      return json(corsHeaders, { error: "Não foi possível remover o acesso" }, 500);
    }
    return json(corsHeaders, { ok: true, revoked: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return json(corsHeaders, { error: "Informe um e-mail válido para o acesso do profissional." }, 400);
  }
  if (!isStrongPassword(password)) {
    return json(
      corsHeaders,
      {
        error:
          "A senha precisa ter no mínimo 8 caracteres, com letra maiúscula, minúscula e número.",
      },
      400,
    );
  }

  if (email === (user.email || "").toLowerCase()) {
    return json(
      corsHeaders,
      { error: "Use um e-mail diferente do dono do estabelecimento para o profissional." },
      400,
    );
  }

  const staffMeta = {
    role: "staff",
    barber_id: barber.id,
    shop_id: shop.id,
    staff_name: barber.name,
  };

  let targetUserId: string | null = barber.user_id;
  let created = false;

  if (targetUserId) {
    // Already linked: reset password / email on the linked account only.
    const { error: pwError } = await admin.auth.admin.updateUserById(targetUserId, {
      password,
      email,
      email_confirm: true,
      user_metadata: staffMeta,
    });
    if (pwError) {
      return json(corsHeaders, { error: "Não foi possível atualizar o acesso." }, 500);
    }
  } else {
    // Prefer create; on duplicate email resolve via exact RPC lookup (no listUsers).
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: staffMeta,
    });

    if (!createError && createdUser.user) {
      targetUserId = createdUser.user.id;
      created = true;
    } else if (isDuplicateEmailError(createError?.message)) {
      const existingId = await findAuthUserIdByEmail(admin, email);
      if (!existingId) {
        return json(
          corsHeaders,
          { error: "Este e-mail já está em uso, mas não foi possível localizar a conta." },
          409,
        );
      }

      const linkBlock = await assertLinkableStaffUser(admin, existingId, barber.id);
      if (linkBlock) {
        return json(corsHeaders, { error: linkBlock }, 409);
      }

      const { error: pwError } = await admin.auth.admin.updateUserById(existingId, {
        password,
        email_confirm: true,
        user_metadata: staffMeta,
      });
      if (pwError) {
        return json(corsHeaders, { error: "Não foi possível atualizar a senha deste acesso." }, 500);
      }
      targetUserId = existingId;
    } else {
      // Ambiguous create failure: try exact lookup once more (race / alternate messages).
      const existingId = await findAuthUserIdByEmail(admin, email);
      if (existingId) {
        const linkBlock = await assertLinkableStaffUser(admin, existingId, barber.id);
        if (linkBlock) {
          return json(corsHeaders, { error: linkBlock }, 409);
        }
        const { error: pwError } = await admin.auth.admin.updateUserById(existingId, {
          password,
          email_confirm: true,
          user_metadata: staffMeta,
        });
        if (pwError) {
          return json(corsHeaders, { error: "Não foi possível atualizar a senha deste acesso." }, 500);
        }
        targetUserId = existingId;
      } else {
        return json(
          corsHeaders,
          { error: createError?.message || "Não foi possível criar o acesso do profissional." },
          500,
        );
      }
    }
  }

  if (!targetUserId) {
    return json(corsHeaders, { error: "Não foi possível resolver o usuário do profissional." }, 500);
  }

  const { error: linkError } = await admin
    .from("barbers")
    .update({ user_id: targetUserId })
    .eq("id", barber.id);

  if (linkError) {
    return json(corsHeaders, { error: "Acesso criado, mas falhou o vínculo. Tente novamente." }, 500);
  }

  return json(corsHeaders, {
    ok: true,
    created,
    barber_id: barber.id,
    email,
    message:
      "Acesso criado. Compartilhe e-mail e senha com o profissional por um canal seguro (WhatsApp). Não enviamos e-mail automático.",
  });
});
