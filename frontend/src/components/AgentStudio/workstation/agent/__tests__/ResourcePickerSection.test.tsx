import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../locales', () => ({ t: (k: string) => k }));
vi.mock('../../shared/ResourcePickerModal', () => ({ default: () => null }));

import { ResourcePickerSection } from '../ResourcePickerSection';
import type { AgentFormData } from '../agent.types';

const baseProps = {
  formData: { name: '', version: 'v1.0.0', systemPromptId: '', tools: [], mcp: [], skills: [] } as AgentFormData,
  setFormData: vi.fn(),
  activePicker: null, setActivePicker: vi.fn(),
  selectedPrompt: undefined, selectedTools: [], selectedMCPs: [], selectedSkills: [],
  availablePrompts: [], availableTools: [], availableMCPs: [], availableSkills: [],
};

describe('ResourcePickerSection', () => {
  it('renders without crashing', () => {
    const { container } = render(<ResourcePickerSection {...baseProps} />);
    expect(container).toBeDefined();
  });
});
