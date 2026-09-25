-- Enable btree_gist extension for GiST exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "gender_type" AS ENUM ('male', 'female', 'unknown');

-- CreateEnum
CREATE TYPE "parent_relation_type" AS ENUM ('biological', 'adopted', 'foster', 'guardian');

-- CreateEnum
CREATE TYPE "partnership_status" AS ENUM ('married', 'partner', 'separated', 'divorced', 'widowed', 'annulled');

-- CreateTable
CREATE TABLE "family_trees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "root_person_id" UUID,
    "allow_concurrent_partnerships" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tree_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "nickname" VARCHAR(100),
    "gender" "gender_type" NOT NULL DEFAULT 'unknown',
    "birth_date" DATE,
    "death_date" DATE,
    "is_living" BOOLEAN NOT NULL DEFAULT true,
    "photo_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_death_after_birth" CHECK ("death_date" IS NULL OR "birth_date" IS NULL OR "death_date" >= "birth_date")
);

-- CreateTable
CREATE TABLE "partnerships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tree_id" UUID NOT NULL,
    "person_a_id" UUID NOT NULL,
    "person_b_id" UUID NOT NULL,
    "status" "partnership_status" NOT NULL DEFAULT 'married',
    "start_date" DATE,
    "end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partnerships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_partner_order" CHECK ("person_a_id" < "person_b_id"),
    CONSTRAINT "chk_partnership_dates" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date"),
    CONSTRAINT "ex_partnership_overlap" EXCLUDE USING gist (
        "person_a_id" WITH =,
        "person_b_id" WITH =,
        daterange("start_date", "end_date", '[)') WITH &&
    )
);

-- CreateTable
CREATE TABLE "parent_child" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tree_id" UUID NOT NULL,
    "parent_id" UUID NOT NULL,
    "child_id" UUID NOT NULL,
    "relation_type" "parent_relation_type" NOT NULL DEFAULT 'biological',
    "partnership_id" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_child_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_not_self_parent" CHECK ("parent_id" <> "child_id"),
    CONSTRAINT "chk_pc_dates" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date")
);

-- CreateIndex
CREATE INDEX "idx_persons_tree" ON "persons"("tree_id");
CREATE INDEX "idx_persons_name" ON "persons"("tree_id", lower("first_name"), lower("last_name"));

-- CreateIndex
CREATE INDEX "idx_partner_a" ON "partnerships"("person_a_id");

-- CreateIndex
CREATE INDEX "idx_partner_b" ON "partnerships"("person_b_id");

-- CreateIndex
CREATE INDEX "idx_pc_parent" ON "parent_child"("parent_id");

-- CreateIndex
CREATE INDEX "idx_pc_child" ON "parent_child"("child_id");

-- CreateIndex
CREATE INDEX "idx_pc_partnership" ON "parent_child"("partnership_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_parent_child" ON "parent_child"("parent_id", "child_id");

-- AddForeignKey
ALTER TABLE "family_trees" ADD CONSTRAINT "family_trees_root_person_id_fkey" FOREIGN KEY ("root_person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_person_a_id_fkey" FOREIGN KEY ("person_a_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_person_b_id_fkey" FOREIGN KEY ("person_b_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_child" ADD CONSTRAINT "parent_child_partnership_id_fkey" FOREIGN KEY ("partnership_id") REFERENCES "partnerships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

