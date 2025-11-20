import { describe, it, expect } from 'vitest';
import { mergeBlobbiStateTags } from '@/lib/blobbi-state-merge';

describe('Progress Tag Updates', () => {
  it('should update existing progress tags correctly', () => {
    // Simulate existing tags with interact_6_progress = "1"
    const existingTags: Array<[string, string]> = [
      ['d', 'blobbi-test'],
      ['stage', 'egg'],
      ['interact_6_progress', '1'],
      ['generation', '1'],
    ];

    // Update progress to 2
    const updatedTags = mergeBlobbiStateTags(existingTags, {
      updateTaskProgress: { taskId: 'interact_6', progress: 2 }
    });

    // Find the progress tag
    const progressTag = updatedTags.find(tag => tag[0] === 'interact_6_progress');
    
    expect(progressTag).toBeDefined();
    expect(progressTag?.[1]).toBe('2');
  });

  it('should add new progress tags when they dont exist', () => {
    // Simulate existing tags without progress tag
    const existingTags: Array<[string, string]> = [
      ['d', 'blobbi-test'],
      ['stage', 'egg'],
      ['generation', '1'],
    ];

    // Add progress tag
    const updatedTags = mergeBlobbiStateTags(existingTags, {
      updateTaskProgress: { taskId: 'interact_6', progress: 1 }
    });

    // Find the progress tag
    const progressTag = updatedTags.find(tag => tag[0] === 'interact_6_progress');
    
    expect(progressTag).toBeDefined();
    expect(progressTag?.[1]).toBe('1');
  });

  it('should update progress tags multiple times', () => {
    // Simulate existing tags with interact_6_progress = "1"
    let existingTags: Array<[string, string]> = [
      ['d', 'blobbi-test'],
      ['stage', 'egg'],
      ['interact_6_progress', '1'],
      ['generation', '1'],
    ];

    // Update progress multiple times
    existingTags = mergeBlobbiStateTags(existingTags, {
      updateTaskProgress: { taskId: 'interact_6', progress: 2 }
    });

    existingTags = mergeBlobbiStateTags(existingTags, {
      updateTaskProgress: { taskId: 'interact_6', progress: 3 }
    });

    // Find the progress tag
    const progressTag = existingTags.find(tag => tag[0] === 'interact_6_progress');
    
    expect(progressTag).toBeDefined();
    expect(progressTag?.[1]).toBe('3');
  });

  it('should preserve other tags while updating progress', () => {
    // Simulate existing tags with multiple tags including progress
    const existingTags: Array<[string, string]> = [
      ['d', 'blobbi-test'],
      ['stage', 'egg'],
      ['interact_6_progress', '1'],
      ['generation', '1'],
      ['start_incubation', '1640995200'],
      ['hunger', '80'],
      ['happiness', '90'],
    ];

    // Update progress
    const updatedTags = mergeBlobbiStateTags(existingTags, {
      updateTaskProgress: { taskId: 'interact_6', progress: 2 }
    });

    // Check that progress is updated
    const progressTag = updatedTags.find(tag => tag[0] === 'interact_6_progress');
    expect(progressTag?.[1]).toBe('2');

    // Check that other tags are preserved
    expect(updatedTags.some(tag => tag[0] === 'start_incubation' && tag[1] === '1640995200')).toBe(true);
    expect(updatedTags.some(tag => tag[0] === 'hunger' && tag[1] === '80')).toBe(true);
    expect(updatedTags.some(tag => tag[0] === 'happiness' && tag[1] === '90')).toBe(true);
  });

  it('should handle multiple progress tags for different tasks', () => {
    // Simulate existing tags with multiple progress tags
    const existingTags: Array<[string, string]> = [
      ['d', 'blobbi-test'],
      ['stage', 'egg'],
      ['interact_6_progress', '1'],
      ['publish_3_posts_progress', '2'],
      ['generation', '1'],
    ];

    // Update only one progress tag
    const updatedTags = mergeBlobbiStateTags(existingTags, {
      updateTaskProgress: { taskId: 'interact_6', progress: 3 }
    });

    // Check that interact_6_progress is updated
    const interactProgressTag = updatedTags.find(tag => tag[0] === 'interact_6_progress');
    expect(interactProgressTag?.[1]).toBe('3');

    // Check that publish_3_posts_progress is unchanged
    const publishProgressTag = updatedTags.find(tag => tag[0] === 'publish_3_posts_progress');
    expect(publishProgressTag?.[1]).toBe('2');
  });
});