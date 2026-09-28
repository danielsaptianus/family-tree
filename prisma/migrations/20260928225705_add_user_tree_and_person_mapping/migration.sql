-- AlterTable
ALTER TABLE "users" ADD COLUMN     "person_id" UUID,
ADD COLUMN     "tree_id" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
