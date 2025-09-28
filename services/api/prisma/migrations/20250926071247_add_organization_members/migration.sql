-- CreateTable
CREATE TABLE "public"."organization_members" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_org_member_user" ON "public"."organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_member_org_user" ON "public"."organization_members"("org_id", "user_id");

-- AddForeignKey
ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
