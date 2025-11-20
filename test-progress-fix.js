// Simple test script to verify progress tag fixes
const { mergeBlobbiStateTags } = require('./src/lib/blobbi-state-merge.ts');

// Test 1: Update existing progress tag
console.log('Test 1: Update existing progress tag');
const existingTags1 = [
  ['d', 'blobbi-test'],
  ['stage', 'egg'],
  ['interact_6_progress', '1'],
  ['generation', '1'],
];

const updatedTags1 = mergeBlobbiStateTags(existingTags1, {
  updateTaskProgress: { taskId: 'interact_6', progress: 2 }
});

const progressTag1 = updatedTags1.find(tag => tag[0] === 'interact_6_progress');
console.log('Progress tag after update:', progressTag1);
console.log('Expected: interact_6_progress = 2');
console.log('✅ Test 1 passed:', progressTag1 && progressTag1[1] === '2');

console.log('\nTest 2: Add new progress tag');
const existingTags2 = [
  ['d', 'blobbi-test'],
  ['stage', 'egg'],
  ['generation', '1'],
];

const updatedTags2 = mergeBlobbiStateTags(existingTags2, {
  updateTaskProgress: { taskId: 'interact_6', progress: 1 }
});

const progressTag2 = updatedTags2.find(tag => tag[0] === 'interact_6_progress');
console.log('Progress tag after add:', progressTag2);
console.log('Expected: interact_6_progress = 1');
console.log('✅ Test 2 passed:', progressTag2 && progressTag2[1] === '1');

console.log('\nTest 3: Multiple updates');
let existingTags3 = [
  ['d', 'blobbi-test'],
  ['stage', 'egg'],
  ['interact_6_progress', '1'],
  ['generation', '1'],
];

existingTags3 = mergeBlobbiStateTags(existingTags3, {
  updateTaskProgress: { taskId: 'interact_6', progress: 2 }
});

existingTags3 = mergeBlobbiStateTags(existingTags3, {
  updateTaskProgress: { taskId: 'interact_6', progress: 3 }
});

const progressTag3 = existingTags3.find(tag => tag[0] === 'interact_6_progress');
console.log('Progress tag after multiple updates:', progressTag3);
console.log('Expected: interact_6_progress = 3');
console.log('✅ Test 3 passed:', progressTag3 && progressTag3[1] === '3');

console.log('\nTest 4: Preserve other tags');
const existingTags4 = [
  ['d', 'blobbi-test'],
  ['stage', 'egg'],
  ['interact_6_progress', '1'],
  ['generation', '1'],
  ['start_incubation', '1640995200'],
  ['hunger', '80'],
  ['happiness', '90'],
];

const updatedTags4 = mergeBlobbiStateTags(existingTags4, {
  updateTaskProgress: { taskId: 'interact_6', progress: 2 }
});

const progressTag4 = updatedTags4.find(tag => tag[0] === 'interact_6_progress');
const startIncubationTag = updatedTags4.find(tag => tag[0] === 'start_incubation');
const hungerTag = updatedTags4.find(tag => tag[0] === 'hunger');

console.log('Progress tag:', progressTag4);
console.log('Start incubation tag:', startIncubationTag);
console.log('Hunger tag:', hungerTag);
console.log('✅ Test 4 passed:', 
  progressTag4 && progressTag4[1] === '2' &&
  startIncubationTag && startIncubationTag[1] === '1640995200' &&
  hungerTag && hungerTag[1] === '80'
);