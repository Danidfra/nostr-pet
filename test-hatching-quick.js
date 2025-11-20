// Quick test to verify hatching logic
import { processHatching } from '../src/lib/blobbi-evolution.js';

// Mock egg Blobbi
const mockEgg = {
  id: 'blobbi-test-egg',
  ownerPubkey: 'test-pubkey',
  name: 'TestEgg',
  birthTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
  lastInteraction: Math.floor(Date.now() / 1000),
  lifeStage: 'egg',
  state: 'active',
  stats: {
    hunger: 60,
    happiness: 80,
    health: 85,
    hygiene: 70,
    energy: 65,
  },
  customization: {
    color: '#ffccaa',
    pattern: 'spotted',
    accessories: [],
  },
  experience: 45,
  coins: 0,
  inventory: [],
  generation: 1,
  breedingReady: false,
  careStreak: 4,
  evolutionProgress: {
    totalCareDays: 4,
    currentStreak: 4,
    lastCareDate: Date.now() - 2 * 60 * 60 * 1000,
    careSessions: [],
    isEligibleForEvolution: true,
    nextEvolutionCheck: Date.now() + 24 * 60 * 60 * 1000,
  },
  // Egg-specific tags that should be removed
  incubationTime: 100000,
  incubationProgress: 95,
  eggTemperature: 75,
  eggStatus: 'ready_to_hatch',
  shellIntegrity: 90,
  // Divine theme
  themeVariant: 'divine',
  crossoverApp: 'divine',
  baseColor: '#55C4A2',
  secondaryColor: '#ffffff', // This should be removed for divine
  specialMark: 'divine_wordmark',
  // Tags with egg and task related items
  tags: [
    ['b', 'blobbi:ecosystem:v1'],
    ['t', 'blobbi'],
    ['d', 'blobbi-test-egg'],
    ['stage', 'egg'],
    ['theme', 'divine'],
    ['crossover_app', 'divine'],
    ['base_color', '#55C4A2'],
    ['secondary_color', '#ffffff'],
    ['special_mark', 'divine_wordmark'],
    ['egg_temperature', '75'],
    ['egg_status', 'ready_to_hatch'],
    ['shell_integrity', '90'],
    ['incubation_time', '100000'],
    ['start_incubation', '1640995200'],
    ['hatch_time', '1641081600'],
    ['interact_6_progress', '3'],
    ['interact_6_confirmed', '1640995200'],
    ['quest_1_progress', '5'],
    ['task_2_confirmed', '1640995200'],
    ['last_warm', '1640995200'],
    ['last_check', '1640995200'],
  ],
};

try {
  console.log('🥚 Testing hatching with egg tags...');
  const { updatedBlobbi } = processHatching(mockEgg);
  
  console.log('✅ Hatching completed successfully');
  console.log('📋 Updated Blobbi stage:', updatedBlobbi.lifeStage);
  
  // Check egg-specific fields are removed
  const eggFields = ['incubationTime', 'incubationProgress', 'eggTemperature', 'eggStatus', 'shellIntegrity'];
  const eggFieldsRemoved = eggFields.every(field => updatedBlobbi[field] === undefined);
  console.log('🧹 Egg-specific fields removed:', eggFieldsRemoved);
  
  // Check task-related tags are removed
  const tagNames = updatedBlobbi.tags?.map(([name]) => name) || [];
  const taskTags = tagNames.filter(name => 
    name.includes('_progress') || 
    name.includes('_confirmed') || 
    name.includes('quest_') || 
    name.includes('task_') ||
    name.includes('incubation_') ||
    [
      'egg_temperature', 'egg_status', 'shell_integrity', 'hatch_time',
      'start_incubation', 'incubation_time', 'start_evolution',
      'last_warm', 'last_check', 'last_talk', 'last_medicine', 'last_sing'
    ].includes(name)
  );
  console.log('🚫 Task/egg tags remaining:', taskTags.length, taskTags);
  
  // Check divine tags are preserved
  const divinePreserved = (
    updatedBlobbi.themeVariant === 'divine' &&
    updatedBlobbi.crossoverApp === 'divine' &&
    updatedBlobbi.specialMark === 'divine_wordmark' &&
    updatedBlobbi.baseColor === '#55C4A2' &&
    updatedBlobbi.secondaryColor === undefined // Removed for divine
  );
  console.log('🌟 Divine tags preserved:', divinePreserved);
  
  // Check canonical order
  const firstTags = updatedBlobbi.tags?.slice(0, 4) || [];
  const canonicalOrder = (
    firstTags[0]?.[0] === 'b' && firstTags[0]?.[1] === 'blobbi:ecosystem:v1' &&
    firstTags[1]?.[0] === 't' && firstTags[1]?.[1] === 'blobbi' &&
    firstTags[2]?.[0] === 'client' && firstTags[2]?.[1] === 'blobbi' &&
    firstTags[3]?.[0] === 'd'
  );
  console.log('📝 Canonical order maintained:', canonicalOrder);
  
  console.log('🎉 All tests completed!');
  
} catch (error) {
  console.error('❌ Test failed:', error);
}