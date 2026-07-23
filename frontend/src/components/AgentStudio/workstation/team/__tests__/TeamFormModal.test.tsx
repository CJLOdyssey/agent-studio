import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../locales', () => ({ t: (k: string) => k }));
vi.mock('../../shared/ResourcePickerModal', () => ({ default: () => null }));

import TeamFormModal from '../TeamFormModal';
import { EMPTY_FORM } from '../validate';

describe('TeamFormModal', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(container).toBeDefined();
  });
});
