CREATE TABLE "builds" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"scope" text NOT NULL,
	"options_json" text DEFAULT '{}',
	"output_path" text NOT NULL,
	"icon_count" integer DEFAULT 0,
	"output_size" integer DEFAULT 0,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"order_index" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icon_versions" (
	"id" text PRIMARY KEY,
	"icon_id" text NOT NULL,
	"svg_path" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icons" (
	"id" text PRIMARY KEY,
	"project_id" text NOT NULL,
	"folder_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"svg_path" text NOT NULL,
	"tags" text DEFAULT '[]',
	"byte_size" integer DEFAULT 0 NOT NULL,
	"original_byte_size" integer DEFAULT 0 NOT NULL,
	"codepoint" text,
	"width" integer DEFAULT 24,
	"height" integer DEFAULT 24,
	"view_box" text DEFAULT '0 0 24 24',
	"has_stroke" integer DEFAULT 0,
	"has_gradient" integer DEFAULT 0,
	"has_text" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY,
	"owner_id" text,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"prefix" text DEFAULT 'icon',
	"color" text DEFAULT '#3b82f6',
	"is_archived" integer DEFAULT 0,
	"visibility" text DEFAULT 'public' NOT NULL,
	"public_access" text DEFAULT 'view' NOT NULL,
	"settings_json" text DEFAULT '{}',
	"purpose" text DEFAULT 'sprite' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"avatar" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "icon_versions" ADD CONSTRAINT "icon_versions_icon_id_icons_id_fkey" FOREIGN KEY ("icon_id") REFERENCES "icons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "icons" ADD CONSTRAINT "icons_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "icons" ADD CONSTRAINT "icons_folder_id_folders_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;