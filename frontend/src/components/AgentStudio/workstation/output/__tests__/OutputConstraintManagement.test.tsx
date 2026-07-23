import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../shared/ResourcePickerModal', () => ({ default: () => null }));

import OutputConstraintManagement from '../OutputConstraintManagement';

describe('OutputConstraintManagement', () => {
  it('renders without crashing', () => {
    const { container } = render(<OutputConstraintManagement />);
    expect(container).toBeDefined();
  });
});
