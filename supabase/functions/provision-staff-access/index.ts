import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFor } from "./_shared/cors.ts";
import {
  buildManagedStaffMetadata,
  isDuplicateEmailError,
  isManagedStaffAccount,
  isShopOwner,
} from "./staff-security.ts";

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
  if (!shop || !isShopOwner(user.id, shop.owner_user_id)) {
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
    const linkedUserId = barber.user_id;
    const { data: linkedAccount } = await admin.auth.admin.getUserById(linkedUserId);

    const { error: unlinkError } = await admin
      .from("barbers")
      .update({ user_id: null })
      .eq("id", barber.id);
    if (unlinkError) {
      return json(corsHeaders, { error: "Não foi possível remover o acesso" }, 500);
    }
    // Delete only an account created for this exact OneFind staff link.
    // Personal and legacy accounts are unlinked but never modified.
    if (
      linkedAccount.user &&
      isManagedStaffAccount(linkedAccount.user.app_metadata, shop.id, barber.id)
    ) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(linkedUserId);
      if (deleteError) {
        console.error("Failed to delete revoked managed staff account", deleteError.message);
      }
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

  const staffMeta = buildManagedStaffMetadata(shop.id, barber.id, barber.name);

  let targetUserId: string | null = barber.user_id;
  let created = false;

  if (targetUserId) {
    const { data: linkedAccount, error: linkedAccountError } = await admin.auth.admin
      .getUserById(targetUserId);
    if (linkedAccountError || !linkedAccount.user) {
      return json(corsHeaders, { error: "Não foi possível validar a conta vinculada." }, 500);
    }

    if (!isManagedStaffAccount(linkedAccount.user.app_metadata, shop.id, barber.id)) {
      return json(
        corsHeaders,
        {
          error:
            "Esta conta não foi criada como acesso gerenciado do OneFind. Remova o acesso e cadastre um novo e-mail.",
        },
        409,
      );
    }

    // Changes are restricted to the managed account created for this exact
    // shop + professional pair.
    const { error: pwError } = await admin.auth.admin.updateUserById(targetUserId, {
      password,
      email,
      email_confirm: true,
      user_metadata: staffMeta,
      app_metadata: staffMeta,
    });
    if (pwError) {
      return json(corsHeaders, { error: "Não foi possível atualizar o acesso." }, 500);
    }
  } else {
    // Never attach or reset a pre-existing account. Account recovery belongs
    // exclusively to the account holder, not to the establishment.
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: staffMeta,
      app_metadata: staffMeta,
    });

    if (!createError && createdUser.user) {
      targetUserId = createdUser.user.id;
      created = true;
    } else if (isDuplicateEmailError(createError?.message)) {
      return json(
        corsHeaders,
        {
          error:
            "Este e-mail já pertence a uma conta. Use outro e-mail; contas existentes não podem ser vinculadas nem ter a senha redefinida pelo estabelecimento.",
        },
        409,
      );
    } else {
      return json(
        corsHeaders,
        { error: createError?.message || "Não foi possível criar o acesso do profissional." },
        500,
      );
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
    if (created) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(targetUserId);
      if (cleanupError) {
        console.error("Failed to clean up unlinked managed staff account", cleanupError.message);
      }
    }
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
