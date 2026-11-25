import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InventorySheet } from './InventorySheet';

const empty = { status: 'ready', sections: [], items: [], starters: [] } as unknown as Parameters<typeof InventorySheet>[0]['inventory'];

describe('the bag with a use still finishing', () => {
  it('says which item is still finishing, and nothing when none is', async () => {
    const { rerender } = render(<InventorySheet open onClose={() => {}} inventory={empty} blobbiName="Brook" onUse={() => {}} openUse openUseItem="Apple" />);
    expect(await screen.findByTestId('inventory-finishing')).toHaveTextContent('An earlier use of Apple is still finishing.');
    rerender(<InventorySheet open onClose={() => {}} inventory={empty} blobbiName="Brook" onUse={() => {}} />);
    expect(screen.queryByTestId('inventory-finishing')).toBeNull();
  });
});
