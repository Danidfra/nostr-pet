/** One key per inventory line: the same item in two inventories is two tiles. */
export function hotbarKey(entry: { inventoryAddress: string; item: { address: string } }): string {
  return `${entry.inventoryAddress}|${entry.item.address}`;
}
