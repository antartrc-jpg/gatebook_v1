-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female', 'diverse', 'unspecified');

-- AlterTable
ALTER TABLE "public"."user_profiles" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "gender" "public"."Gender" DEFAULT 'unspecified';

-- CreateIndex
CREATE INDEX "idx_user_profiles_lastname" ON "public"."user_profiles"("last_name");
