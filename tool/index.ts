/**
 * submit-scan — Supabase Edge Function
 *
 * Accepts a multipart/form-data POST from the client, uploads the file to
 * Supabase Storage, inserts a pending forensic_reports row, then dispatches
 * the forensic_scan GitHub Actions workflow.
 *
 * Request (multipart/form-data):
 *   file      File     — the image or PDF to scan
 *   user_id   string   — authenticated user ID
 *   mode?     string   — "light" | "full" (default "full")
 *
 * Response 200:
 *   { report_id: string, status: "pending" }
 *
 * Required env vars (set in Supabase Dashboard → Settings → Edge Functions):
 *   SUPABASE_URL                — project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — service-role key (bypasses RLS)
 *   GITHUB_TOKEN                — fine-grained PAT with Actions: write scope
 *   GITHUB_REPO                 — e.g. "myorg/forensic-engine"
 *   GITHUB_WORKFLOW_FILE        — e.g. "forensic_scan.yml"
 *   GITHUB_REF                  — branch to run on, e.g. "main"
 *   STORAGE_BUCKET              — Supabase Storage bucket name, e.g. "forensic-files"
 *   FILE_SIGNED_URL_EXPIRY_SEC  — signed URL TTL in seconds (default 3600)
 */

import { serve }         from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient }  from "https://esm.sh/@supabase/supabase-js@2";

// ─── helpers ──────────────────────────────────────────────────────────────────

function env(key: string, fallback?: string): string {
  const val = Deno.env.get(key) ?? fallback;
  if (val === undefined) throw new Error(`Missing env var: ${key}`);
  return val;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── main ─────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // ── CORS pre-flight ──────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ── Parse multipart body ─────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonResponse({ error: "Expected multipart/form-data" }, 400);
  }

  const file    = formData.get("file") as File | null;
  const userId  = (formData.get("user_id")  as string | null)?.trim();
  const mode    = (formData.get("mode")     as string | null)?.trim() ?? "full";

  if (!file || !userId) {
    return jsonResponse({ error: "'file' and 'user_id' are required" }, 400);
  }

  // ── Validate mode ────────────────────────────────────────────────────────
  if (!["light", "full"].includes(mode)) {
    return jsonResponse({ error: "'mode' must be 'light' or 'full'" }, 400);
  }

  // ── Validate file type (basic) ───────────────────────────────────────────
  const ALLOWED_TYPES = new Set([
    "image/jpeg", "image/jpg", "image/png", "image/gif",
    "image/bmp", "image/tiff", "image/webp",
    "application/pdf",
  ]);
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return jsonResponse(
      { error: `Unsupported file type: ${file.type}. Supported: images and PDF.` },
      415,
    );
  }

  // ── Max file size: 100 MB ────────────────────────────────────────────────
  const MAX_BYTES = 100 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return jsonResponse({ error: "File exceeds 100 MB limit" }, 413);
  }

  // ── Supabase client (service role — bypasses RLS) ────────────────────────
  const supabase = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
  );

  // ── Upload to Supabase Storage ───────────────────────────────────────────
  const bucket    = env("STORAGE_BUCKET", "forensic-files");
  const ts        = Date.now();
  const safeFile  = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath  = `${userId}/${ts}_${safeFile}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert:      false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return jsonResponse({ error: "Failed to store file", detail: uploadError.message }, 500);
  }

  // ── Create the forensic_reports row ─────────────────────────────────────
  const { data: report, error: insertError } = await supabase
    .from("forensic_reports")
    .insert({
      user_id:   userId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type || null,
      file_size: file.size,
      status:    "pending",
      mode,
    })
    .select("id")
    .single();

  if (insertError || !report) {
    console.error("DB insert error:", insertError);
    // Clean up the uploaded file so we don't leave orphans
    await supabase.storage.from(bucket).remove([filePath]);
    return jsonResponse({ error: "Failed to create report record", detail: insertError?.message }, 500);
  }

  const reportId = report.id as string;

  // ── Generate a signed URL (expires in N seconds) ─────────────────────────
  const expiresIn = Number(env("FILE_SIGNED_URL_EXPIRY_SEC", "3600"));
  const { data: signed, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (signedError || !signed?.signedUrl) {
    console.error("Signed URL error:", signedError);
    return jsonResponse({ error: "Failed to create signed URL", detail: signedError?.message }, 500);
  }

  // ── Trigger GitHub Actions workflow ──────────────────────────────────────
  const ghRepo         = env("GITHUB_REPO");         // "owner/repo"
  const ghWorkflowFile = env("GITHUB_WORKFLOW_FILE", "forensic_scan.yml");
  const ghRef          = env("GITHUB_REF",           "main");
  const ghToken        = env("GITHUB_TOKEN");

  const dispatchUrl = `https://api.github.com/repos/${ghRepo}/actions/workflows/${ghWorkflowFile}/dispatches`;

  const ghResponse = await fetch(dispatchUrl, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${ghToken}`,
      Accept:         "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: ghRef,
      inputs: {
        user_id:   userId,
        report_id: reportId,
        file_url:  signed.signedUrl,
        file_name: file.name,
        mode,
      },
    }),
  });

  if (!ghResponse.ok) {
    const body = await ghResponse.text();
    console.error("GitHub dispatch error:", ghResponse.status, body);
    // Mark the DB row as failed rather than leaving it stuck as "pending"
    await supabase
      .from("forensic_reports")
      .update({
        status:        "failed",
        error_message: `GitHub Actions dispatch failed (HTTP ${ghResponse.status}): ${body}`,
        completed_at:  new Date().toISOString(),
      })
      .eq("id", reportId);
    return jsonResponse(
      { error: "Failed to trigger scan workflow", detail: body },
      500,
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  return jsonResponse(
    {
      report_id: reportId,
      status:    "pending",
      message:   "Scan queued. Poll /forensic_reports?id=eq.<report_id> for results.",
    },
    202,
  );
});
