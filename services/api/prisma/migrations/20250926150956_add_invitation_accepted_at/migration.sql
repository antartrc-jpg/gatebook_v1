-- AlterTable
ALTER TABLE "public"."invitations" ADD COLUMN     "accepted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "idx_invitation_email_expires" ON "public"."invitations"("email", "expires_at");

-- CreateIndex
CREATE INDEX "idx_invitation_accepted" ON "public"."invitations"("accepted_at");
