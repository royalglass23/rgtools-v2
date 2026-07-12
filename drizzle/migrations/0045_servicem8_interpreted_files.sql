CREATE TABLE IF NOT EXISTS "servicem8_interpreted_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "servicem8_attachment_uuid" text NOT NULL,
  "servicem8_job_uuid" text NOT NULL,
  "name" text,
  "file_type" text,
  "attachment_source" text,
  "edit_date" text NOT NULL,
  "status" text NOT NULL,
  "summary" text,
  "model" text,
  "interpreted_at" timestamp with time zone,
  "error_message" text,
  "error_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "servicem8_interpreted_files_attachment_edit_uq"
  ON "servicem8_interpreted_files" ("servicem8_attachment_uuid", "edit_date");

CREATE INDEX IF NOT EXISTS "servicem8_interpreted_files_job_idx"
  ON "servicem8_interpreted_files" ("servicem8_job_uuid");

CREATE INDEX IF NOT EXISTS "servicem8_interpreted_files_status_idx"
  ON "servicem8_interpreted_files" ("status");
