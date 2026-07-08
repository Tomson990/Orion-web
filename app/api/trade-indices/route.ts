import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://jmrwyluomrranyetgecw.supabase.co",
  "sb_publishable_WJtPwj9Ufax4Y9kZYSUhdA_qCvsb89-"
);

export async function GET() {
  const { data, error } = await supabase
    .from("trade_indices")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const latest: Record<string, { valor: number; fecha: string }> = {};
  for (const row of data) {
    if (!latest[row.indicador]) {
      latest[row.indicador] = { valor: row.valor, fecha: row.fecha };
    }
  }

  return NextResponse.json(latest);
}
