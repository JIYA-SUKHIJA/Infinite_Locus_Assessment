import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../../src/components/Footer';

describe('Footer Component Tests', () => {
  it('renders static branding, isolation claims, and specification compliance copy literally', () => {
    render(<Footer />);

    const footerElement = screen.getByRole('contentinfo', {
      name: 'System status and compliance metadata'
    });

    expect(footerElement).toBeDefined();
    expect(screen.getByText('System Operational (Readiness Engine v1.0)')).toBeDefined();
    expect(screen.getByText('Strict Tenant Isolation Active')).toBeDefined();
    expect(screen.getByText('IEEE Std 830-1998 Specification Compliant')).toBeDefined();
    expect(
      screen.getByText('Student Readiness Control Center • Evaluator Interface')
    ).toBeDefined();
  });
});
