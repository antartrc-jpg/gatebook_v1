/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."OrgStatus" AS ENUM ('active', 'trial', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "public"."OrgPlan" AS ENUM ('free', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "public"."LegalForm" AS ENUM ('gmbh', 'ug', 'ag', 'kg', 'ohg', 'ek', 'gbr', 'ev', 'stiftung', 'llc', 'inc', 'plc', 'sarl', 'sas', 'srl', 'bv', 'nv', 'oy', 'ab', 'kft', 'spa', 'other');

-- CreateEnum
CREATE TYPE "public"."AddressKind" AS ENUM ('headquarters', 'billing', 'shipping');

-- AlterTable
ALTER TABLE "public"."organizations" ADD COLUMN     "email" TEXT,
ADD COLUMN     "legalForm" "public"."LegalForm",
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "plan" "public"."OrgPlan" NOT NULL DEFAULT 'free',
ADD COLUMN     "regCountry" TEXT,
ADD COLUMN     "regNumber" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "status" "public"."OrgStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "timezone" TEXT DEFAULT 'Europe/Berlin',
ADD COLUMN     "vatId" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "public"."org_addresses" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "kind" "public"."AddressKind" NOT NULL,
    "street" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."org_domains" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_org_address_org" ON "public"."org_addresses"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_address_kind" ON "public"."org_addresses"("org_id", "kind");

-- CreateIndex
CREATE INDEX "idx_org_domain_org" ON "public"."org_domains"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_domain" ON "public"."org_domains"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "public"."organizations"("slug");

-- CreateIndex
CREATE INDEX "idx_org_status" ON "public"."organizations"("status");

-- AddForeignKey
ALTER TABLE "public"."org_addresses" ADD CONSTRAINT "org_addresses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."org_domains" ADD CONSTRAINT "org_domains_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
