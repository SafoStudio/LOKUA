import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscussionCommentQuotas1795020000000 implements MigrationInterface {
  name = 'AddDiscussionCommentQuotas1795020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "discussion_comment_quotas" ("author_id" uuid NOT NULL, "posted_at" TIMESTAMP WITH TIME ZONE array NOT NULL, CONSTRAINT "PK_78e32e99bf27c403cb05109324e" PRIMARY KEY ("author_id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "discussion_comment_quotas" ADD CONSTRAINT "FK_78e32e99bf27c403cb05109324e" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discussion_comment_quotas" DROP CONSTRAINT "FK_78e32e99bf27c403cb05109324e"`
    );
    await queryRunner.query(`DROP TABLE "discussion_comment_quotas"`);
  }
}
