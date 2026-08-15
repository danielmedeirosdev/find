import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Lembretes de agendamento (cron) — só avisa o profissional no painel.
 * Sem integração WhatsApp externa.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().slice(0, 10);

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, shop_id, client_name, client_phone, time, pets(name), shops(name)")
      .eq("date", date)
      .in("status", ["scheduled", "confirmed"]);

    if (error) throw error;

    let notified = 0;

    for (const b of bookings || []) {
      const petName = (b.pets as { name?: string } | null)?.name;
      const title = "Lembrete de amanhã";
      const body = `${petName || b.client_name} · ${b.time}`;

      await supabase.rpc("notify_shop_owner", {
        p_shop_id: b.shop_id,
        p_kind: "booking_reminder",
        p_title: title,
        p_body: body,
        p_booking_id: b.id,
      });
      notified += 1;
    }

    return new Response(
      JSON.stringify({
        date,
        bookings: bookings?.length ?? 0,
        owner_notifications: notified,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-reminders error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
