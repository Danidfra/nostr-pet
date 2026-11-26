import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { en } from '@/i18n/messages/en';
import { CareError } from './CareFeedback';

describe('CareError', () => {
  it('shows nothing without an error', () => {
    const { container } = render(<CareError error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the relays refused a write, not the runtime’s AggregateError text', () => {
    render(<CareError error={new AggregateError([new Error('blocked')], 'All promises were rejected')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(en.home.notice.notAccepted);
    expect(screen.getByRole('alert')).not.toHaveTextContent('All promises were rejected');
  });

  it('keeps a translated error’s own words', () => {
    render(<CareError error={new Error('The signer did not answer.')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The signer did not answer.');
  });
});
