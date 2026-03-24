import type { Timestamps } from './common';

export type DocumentTemplateType = 'invoice' | 'receipt' | 'packing_slip' | 'purchase_order' | 'label';

export type DocumentTemplate = Timestamps & {
  id: string;
  type: DocumentTemplateType;
  name: string;
  content: string;
  isDefault: boolean;
};
