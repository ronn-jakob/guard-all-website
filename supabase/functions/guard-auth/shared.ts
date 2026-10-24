declare const Deno: {
  env: { get(key: string): string | undefined };
};

// @ts-ignore - The npm: specifier resolves correctly in the deployed Supabase Edge runtime.
import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Audit triggers resolve the actor from the x-guard-actor header. A request that
// has not authenticated (login, password-reset request) keeps the plain admin
// client, so no actor is recorded for work that has no session.
export function createRequestClient(actorId: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { "x-guard-actor": actorId } },
    },
  );
}

export function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
