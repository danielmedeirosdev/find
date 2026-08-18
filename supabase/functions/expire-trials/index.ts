import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

    const now = new Date();
    const { data: trials, error } = await supabase
      .from("shops")
      .select("id, complimentary_until")
      .eq("subscription_status", "trial")
      .lt("trial_ends_at", now.toISOString());

    if (error) throw error;

    const toBlock = (trials || []).filter((shop) => {
      if (!shop.complimentary_until) return true;
      return new Date(shop.complimentary_until) <= now;
    }).map((shop) => shop.id);

    if (toBlock.length === 0) {
      return new Response(JSON.stringify({ expired: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error: updateError } = await supabase
      .from("shops")
      .update({ subscription_status: "blocked" })
      .in("id", toBlock)
      .select("id");

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ expired: data?.length ?? 0 }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("expire-trials error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
