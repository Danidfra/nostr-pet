import { BlobbiItem } from '@/types/blobbi';

export const SHOP_ITEMS: BlobbiItem[] = [
  // Food items
  { id: 'food_apple', name: 'Apple', type: 'food', price: 10, effect: { hunger: 15 }, icon: '🍎' },
  { id: 'food_burger', name: 'Burger', type: 'food', price: 25, effect: { hunger: 40, happiness: 10 }, icon: '🍔' },
  { id: 'food_cake', name: 'Cake', type: 'food', price: 50, effect: { hunger: 20, happiness: 30 }, icon: '🎂' },
  { id: 'food_pizza', name: 'Pizza', type: 'food', price: 35, effect: { hunger: 35, happiness: 15 }, icon: '🍕' },
  { id: 'food_sushi', name: 'Sushi', type: 'food', price: 45, effect: { hunger: 30, health: 10 }, icon: '🍣' },
  
  // Toys
  { id: 'toy_ball', name: 'Ball', type: 'toy', price: 30, effect: { happiness: 25 }, icon: '⚽' },
  { id: 'toy_teddy', name: 'Teddy Bear', type: 'toy', price: 60, effect: { happiness: 40 }, icon: '🧸' },
  { id: 'toy_blocks', name: 'Building Blocks', type: 'toy', price: 40, effect: { happiness: 30, energy: -10 }, icon: '🧱' },
  { id: 'toy_puzzle', name: 'Puzzle', type: 'toy', price: 50, effect: { happiness: 35, energy: -15 }, icon: '🧩' },
  
  // Medicine
  { id: 'med_vitamins', name: 'Vitamins', type: 'medicine', price: 40, effect: { health: 20 }, icon: '💊' },
  { id: 'med_super', name: 'Super Medicine', type: 'medicine', price: 100, effect: { health: 50, energy: 20 }, icon: '💉' },
  { id: 'med_bandage', name: 'Bandage', type: 'medicine', price: 20, effect: { health: 15 }, icon: '🩹' },
  { id: 'med_elixir', name: 'Health Elixir', type: 'medicine', price: 150, effect: { health: 80, happiness: 20 }, icon: '🧪' },
  
  // Hygiene items (for cleaning)
  { id: 'hyg_soap', name: 'Soap', type: 'hygiene', price: 15, effect: { hygiene: 30 }, icon: '🧼' },
  { id: 'hyg_shampoo', name: 'Shampoo', type: 'hygiene', price: 25, effect: { hygiene: 50, happiness: 10 }, icon: '🧴' },
  { id: 'hyg_bubble', name: 'Bubble Bath', type: 'hygiene', price: 40, effect: { hygiene: 60, happiness: 20 }, icon: '🛁' },
  { id: 'hyg_towel', name: 'Soft Towel', type: 'hygiene', price: 20, effect: { hygiene: 25, happiness: 5 }, icon: '🏖️' },
  
  // Accessories (for future customization)
  { id: 'acc_hat', name: 'Party Hat', type: 'accessory', price: 75, icon: '🎩' },
  { id: 'acc_glasses', name: 'Cool Glasses', type: 'accessory', price: 60, icon: '🕶️' },
  { id: 'acc_bow', name: 'Bow Tie', type: 'accessory', price: 50, icon: '🎀' },
  { id: 'acc_crown', name: 'Crown', type: 'accessory', price: 100, icon: '👑' },
];

// Helper function to get item by ID
export function getShopItemById(id: string): BlobbiItem | undefined {
  return SHOP_ITEMS.find(item => item.id === id);
}

// Helper function to get items by type
export function getShopItemsByType(type: BlobbiItem['type']): BlobbiItem[] {
  return SHOP_ITEMS.filter(item => item.type === type);
}