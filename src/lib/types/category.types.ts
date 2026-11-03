export const CATEGORY_KINDS = ['expense', 'income_source'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  /** One of the swatch keys in `CATEGORY_COLORS`. */
  color: string | null;
  archived: boolean;
};
