ALTER TYPE "tasso_card_priority" RENAME TO "seiryu_card_priority";

ALTER TABLE "tasso_projects" RENAME TO "seiryu_projects";
ALTER TABLE "tasso_columns" RENAME TO "seiryu_columns";
ALTER TABLE "tasso_cards" RENAME TO "seiryu_cards";
ALTER TABLE "tasso_checklist_items" RENAME TO "seiryu_checklist_items";
ALTER TABLE "tasso_labels" RENAME TO "seiryu_labels";
ALTER TABLE "tasso_card_labels" RENAME TO "seiryu_card_labels";

ALTER INDEX "tasso_projects_workspace_id_idx" RENAME TO "seiryu_projects_workspace_id_idx";
ALTER INDEX "tasso_columns_project_id_idx" RENAME TO "seiryu_columns_project_id_idx";
ALTER INDEX "tasso_cards_project_id_idx" RENAME TO "seiryu_cards_project_id_idx";
ALTER INDEX "tasso_cards_column_id_idx" RENAME TO "seiryu_cards_column_id_idx";
ALTER INDEX "tasso_checklist_items_card_id_idx" RENAME TO "seiryu_checklist_items_card_id_idx";
ALTER INDEX "tasso_labels_project_id_idx" RENAME TO "seiryu_labels_project_id_idx";
ALTER INDEX "tasso_labels_project_name_idx" RENAME TO "seiryu_labels_project_name_idx";
ALTER INDEX "tasso_card_labels_card_id_idx" RENAME TO "seiryu_card_labels_card_id_idx";
ALTER INDEX "tasso_card_labels_label_id_idx" RENAME TO "seiryu_card_labels_label_id_idx";