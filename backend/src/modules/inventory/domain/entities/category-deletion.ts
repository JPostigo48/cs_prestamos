export interface CategoryDeletionPreview {
  categoryId: string;
  nombre: string;
  resourceIds: string[];
  copyIds: string[];
  accessoryIds: string[];
  resourceCount: number;
  copyCount: number;
  blockers: { dependency: string; count: number; reason: string }[];
  canDelete: boolean;
  wouldDelete: {
    categories: number;
    resources: number;
    copies: number;
    accessories: number;
  };
  alternative: 'DEACTIVATE';
}
