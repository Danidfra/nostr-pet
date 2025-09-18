import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scrollToElementWithAlignment } from './utils';

// Mock DOM environment
beforeEach(() => {
  // Mock window object
  Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
  Object.defineProperty(window, 'pageYOffset', { value: 0, writable: true });
  Object.defineProperty(window, 'scrollTo', {
    value: vi.fn(),
    writable: true
  });
  
  // Mock document element
  Object.defineProperty(document.documentElement, 'getComputedStyle', {
    value: vi.fn(() => ({
      getPropertyValue: vi.fn(() => '0') // No safe area inset by default
    }))
  });
});

describe('scrollToElementWithAlignment', () => {
  it('should scroll element to center by default', () => {
    const mockElement = {
      getBoundingClientRect: vi.fn(() => ({
        top: 400,
        bottom: 600,
        height: 200,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: 400,
        toJSON: vi.fn()
      }))
    } as unknown as HTMLElement;

    scrollToElementWithAlignment(mockElement);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 200, // 0 (pageYOffset) + 400 (top) - (800 - 200) / 2 = 200
      behavior: 'smooth'
    });
  });

  it('should scroll element to start with alignment', () => {
    const mockElement = {
      getBoundingClientRect: vi.fn(() => ({
        top: 400,
        bottom: 600,
        height: 200,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: 400,
        toJSON: vi.fn()
      }))
    } as unknown as HTMLElement;

    scrollToElementWithAlignment(mockElement, {
      align: 'start'
    });

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 400, // 0 (pageYOffset) + 400 (top) - 0 (safe area) - 0 (offset) = 400
      behavior: 'smooth'
    });
  });

  it('should scroll element to end with alignment', () => {
    const mockElement = {
      getBoundingClientRect: vi.fn(() => ({
        top: 400,
        bottom: 600,
        height: 200,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: 400,
        toJSON: vi.fn()
      }))
    } as unknown as HTMLElement;

    scrollToElementWithAlignment(mockElement, {
      align: 'end'
    });

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 200, // 0 (pageYOffset) + 600 (bottom) - 800 (viewportHeight) + 0 (offset) = 200
      behavior: 'smooth'
    });
  });

  it('should apply offset correctly', () => {
    const mockElement = {
      getBoundingClientRect: vi.fn(() => ({
        top: 400,
        bottom: 600,
        height: 200,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: 400,
        toJSON: vi.fn()
      }))
    } as unknown as HTMLElement;

    scrollToElementWithAlignment(mockElement, {
      align: 'start',
      offset: 100
    });

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 300, // 0 (pageYOffset) + 400 (top) - 0 (safe area) - 100 (offset) = 300
      behavior: 'smooth'
    });
  });

  it('should handle safe area inset', () => {
    // Mock safe area inset
    Object.defineProperty(document.documentElement, 'getComputedStyle', {
      value: vi.fn(() => ({
        getPropertyValue: vi.fn(() => '44') // 44px safe area inset
      }))
    });

    const mockElement = {
      getBoundingClientRect: vi.fn(() => ({
        top: 100,
        bottom: 300,
        height: 200,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: 100,
        toJSON: vi.fn()
      }))
    } as unknown as HTMLElement;

    scrollToElementWithAlignment(mockElement, {
      align: 'start'
    });

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 56, // 0 (pageYOffset) + 100 (top) - 44 (safe area) - 0 (offset) = 56
      behavior: 'smooth'
    });
  });

  it('should use nearest alignment for element closer to top', () => {
    const mockElement = {
      getBoundingClientRect: vi.fn(() => ({
        top: 100,
        bottom: 300,
        height: 200,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: 100,
        toJSON: vi.fn()
      }))
    } as unknown as HTMLElement;

    scrollToElementWithAlignment(mockElement, {
      align: 'nearest'
    });

    // Distance from top: 100px, Distance from bottom: 500px (800 - 300)
    // Should choose start (top) since it's closer
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 100, // 0 (pageYOffset) + 100 (top) - 0 (safe area) - 0 (offset) = 100
      behavior: 'smooth'
    });
  });

  it('should use nearest alignment for element closer to bottom', () => {
    const mockElement = {
      getBoundingClientRect: vi.fn(() => ({
        top: 500,
        bottom: 700,
        height: 200,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: 500,
        toJSON: vi.fn()
      }))
    } as unknown as HTMLElement;

    scrollToElementWithAlignment(mockElement, {
      align: 'nearest'
    });

    // Distance from top: 500px, Distance from bottom: 100px (800 - 700)
    // Should choose end (bottom) since it's closer
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 100, // 0 (pageYOffset) + 700 (bottom) - 800 (viewportHeight) + 0 (offset) = 100
      behavior: 'smooth'
    });
  });

  it('should allow custom scroll behavior', () => {
    const mockElement = {
      getBoundingClientRect: vi.fn(() => ({
        top: 400,
        bottom: 600,
        height: 200,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: 400,
        toJSON: vi.fn()
      }))
    } as unknown as HTMLElement;

    scrollToElementWithAlignment(mockElement, {
      align: 'center',
      behavior: 'auto'
    });

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 200,
      behavior: 'auto'
    });
  });
});