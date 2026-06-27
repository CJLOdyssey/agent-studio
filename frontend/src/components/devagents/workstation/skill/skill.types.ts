export interface SkillEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'installed' | 'available';
  version: string;
  author: string;
  instructions: string;
  prompt_id: string;
  tool_names: string[];
  output_constraint: string;
  createdAt: string;
}

export type SkillFormData = Omit<SkillEntry, 'id' | 'createdAt'>;
