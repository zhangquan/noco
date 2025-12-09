/**
 * Frame and coordinate utility functions
 */

import type { Frame, NodeSchema } from '../types.js';
import { isNil, isNumber, approximatelyEqual, rangesOverlap, getOverlap } from './utils.js';

/**
 * Normalize frame by calculating right and bottom values
 */
export function normalizeFrame(frame: Partial<Frame>): Frame {
  const left = frame.left ?? 0;
  const top = frame.top ?? 0;
  const width = frame.width ?? 0;
  const height = frame.height ?? 0;

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

/**
 * Check if a frame is valid (has positive dimensions)
 */
export function isValidFrame(frame?: Partial<Frame>): frame is Frame {
  if (!frame) return false;
  return (
    isNumber(frame.left) &&
    isNumber(frame.top) &&
    isNumber(frame.width) &&
    isNumber(frame.height) &&
    frame.width >= 0 &&
    frame.height >= 0
  );
}

/**
 * Get the frame from a node, normalizing if needed
 */
export function getNodeFrame(node: NodeSchema): Frame | undefined {
  if (!node.frame) return undefined;
  return normalizeFrame(node.frame);
}

/**
 * Check if two frames overlap horizontally
 */
export function framesOverlapHorizontally(
  frame1: Frame,
  frame2: Frame,
  tolerance: number = 0
): boolean {
  const f1 = normalizeFrame(frame1);
  const f2 = normalizeFrame(frame2);
  return rangesOverlap(f1.left, f1.right!, f2.left, f2.right!, tolerance);
}

/**
 * Check if two frames overlap vertically
 */
export function framesOverlapVertically(
  frame1: Frame,
  frame2: Frame,
  tolerance: number = 0
): boolean {
  const f1 = normalizeFrame(frame1);
  const f2 = normalizeFrame(frame2);
  return rangesOverlap(f1.top, f1.bottom!, f2.top, f2.bottom!, tolerance);
}

/**
 * Check if two frames overlap (intersect)
 */
export function framesOverlap(
  frame1: Frame,
  frame2: Frame,
  tolerance: number = 0
): boolean {
  return (
    framesOverlapHorizontally(frame1, frame2, tolerance) &&
    framesOverlapVertically(frame1, frame2, tolerance)
  );
}

/**
 * Get horizontal overlap between two frames
 */
export function getHorizontalOverlap(frame1: Frame, frame2: Frame): number {
  const f1 = normalizeFrame(frame1);
  const f2 = normalizeFrame(frame2);
  return getOverlap(f1.left, f1.right!, f2.left, f2.right!);
}

/**
 * Get vertical overlap between two frames
 */
export function getVerticalOverlap(frame1: Frame, frame2: Frame): number {
  const f1 = normalizeFrame(frame1);
  const f2 = normalizeFrame(frame2);
  return getOverlap(f1.top, f1.bottom!, f2.top, f2.bottom!);
}

/**
 * Calculate the horizontal gap between two frames
 * Negative value indicates overlap
 */
export function getHorizontalGap(frame1: Frame, frame2: Frame): number {
  const f1 = normalizeFrame(frame1);
  const f2 = normalizeFrame(frame2);
  
  // frame1 is to the left of frame2
  if (f1.right! <= f2.left) {
    return f2.left - f1.right!;
  }
  // frame2 is to the left of frame1
  if (f2.right! <= f1.left) {
    return f1.left - f2.right!;
  }
  // They overlap
  return -getHorizontalOverlap(frame1, frame2);
}

/**
 * Calculate the vertical gap between two frames
 * Negative value indicates overlap
 */
export function getVerticalGap(frame1: Frame, frame2: Frame): number {
  const f1 = normalizeFrame(frame1);
  const f2 = normalizeFrame(frame2);
  
  // frame1 is above frame2
  if (f1.bottom! <= f2.top) {
    return f2.top - f1.bottom!;
  }
  // frame2 is above frame1
  if (f2.bottom! <= f1.top) {
    return f1.top - f2.bottom!;
  }
  // They overlap
  return -getVerticalOverlap(frame1, frame2);
}

/**
 * Get bounding box of multiple frames
 */
export function getBoundingFrame(frames: Frame[]): Frame | undefined {
  if (frames.length === 0) return undefined;

  const normalizedFrames = frames.map(normalizeFrame);

  const left = Math.min(...normalizedFrames.map(f => f.left));
  const top = Math.min(...normalizedFrames.map(f => f.top));
  const right = Math.max(...normalizedFrames.map(f => f.right!));
  const bottom = Math.max(...normalizedFrames.map(f => f.bottom!));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    right,
    bottom,
  };
}

/**
 * Calculate relative frame (child relative to parent)
 */
export function getRelativeFrame(childFrame: Frame, parentFrame: Frame): Frame {
  const child = normalizeFrame(childFrame);
  const parent = normalizeFrame(parentFrame);

  return {
    left: child.left - parent.left,
    top: child.top - parent.top,
    width: child.width,
    height: child.height,
    right: child.right! - parent.left,
    bottom: child.bottom! - parent.top,
  };
}

/**
 * Check if childFrame is contained within parentFrame
 */
export function frameContains(
  parentFrame: Frame,
  childFrame: Frame,
  tolerance: number = 0
): boolean {
  const parent = normalizeFrame(parentFrame);
  const child = normalizeFrame(childFrame);

  return (
    child.left >= parent.left - tolerance &&
    child.top >= parent.top - tolerance &&
    child.right! <= parent.right! + tolerance &&
    child.bottom! <= parent.bottom! + tolerance
  );
}

/**
 * Check if two frames are horizontally aligned (same top and height)
 */
export function areHorizontallyAligned(
  frame1: Frame,
  frame2: Frame,
  tolerance: number = 2
): boolean {
  const f1 = normalizeFrame(frame1);
  const f2 = normalizeFrame(frame2);

  return (
    approximatelyEqual(f1.top, f2.top, tolerance) &&
    approximatelyEqual(f1.height, f2.height, tolerance)
  );
}

/**
 * Check if two frames are vertically aligned (same left and width)
 */
export function areVerticallyAligned(
  frame1: Frame,
  frame2: Frame,
  tolerance: number = 2
): boolean {
  const f1 = normalizeFrame(frame1);
  const f2 = normalizeFrame(frame2);

  return (
    approximatelyEqual(f1.left, f2.left, tolerance) &&
    approximatelyEqual(f1.width, f2.width, tolerance)
  );
}

/**
 * Calculate padding between container and content frames
 */
export function calculatePadding(
  containerFrame: Frame,
  contentFrame: Frame
): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const container = normalizeFrame(containerFrame);
  const content = normalizeFrame(contentFrame);

  return {
    top: Math.max(0, content.top - container.top),
    right: Math.max(0, container.right! - content.right!),
    bottom: Math.max(0, container.bottom! - content.bottom!),
    left: Math.max(0, content.left - container.left),
  };
}

/**
 * Sort frames by their position (left to right, top to bottom)
 */
export function sortFramesByPosition(
  nodes: NodeSchema[],
  direction: 'row' | 'column' = 'row'
): NodeSchema[] {
  return [...nodes].sort((a, b) => {
    const frameA = getNodeFrame(a);
    const frameB = getNodeFrame(b);

    if (!frameA || !frameB) return 0;

    if (direction === 'row') {
      // Sort by left position, then by top
      if (frameA.left !== frameB.left) {
        return frameA.left - frameB.left;
      }
      return frameA.top - frameB.top;
    } else {
      // Sort by top position, then by left
      if (frameA.top !== frameB.top) {
        return frameA.top - frameB.top;
      }
      return frameA.left - frameB.left;
    }
  });
}

/**
 * Check if nodes can be arranged in a single row
 * (no significant vertical overlap preventing horizontal arrangement)
 */
export function canArrangeInRow(nodes: NodeSchema[], tolerance: number = 0): boolean {
  if (nodes.length <= 1) return true;

  const sortedNodes = sortFramesByPosition(nodes, 'row');
  
  for (let i = 1; i < sortedNodes.length; i++) {
    const prevFrame = getNodeFrame(sortedNodes[i - 1]);
    const currFrame = getNodeFrame(sortedNodes[i]);
    
    if (!prevFrame || !currFrame) continue;
    
    // Check if current element starts after previous ends (with tolerance)
    if (currFrame.left < prevFrame.right! - tolerance) {
      // They overlap horizontally, check vertical overlap
      if (framesOverlapVertically(prevFrame, currFrame, -tolerance)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if nodes can be arranged in a single column
 * (no significant horizontal overlap preventing vertical arrangement)
 */
export function canArrangeInColumn(nodes: NodeSchema[], tolerance: number = 0): boolean {
  if (nodes.length <= 1) return true;

  const sortedNodes = sortFramesByPosition(nodes, 'column');
  
  for (let i = 1; i < sortedNodes.length; i++) {
    const prevFrame = getNodeFrame(sortedNodes[i - 1]);
    const currFrame = getNodeFrame(sortedNodes[i]);
    
    if (!prevFrame || !currFrame) continue;
    
    // Check if current element starts after previous ends (with tolerance)
    if (currFrame.top < prevFrame.bottom! - tolerance) {
      // They overlap vertically, check horizontal overlap
      if (framesOverlapHorizontally(prevFrame, currFrame, -tolerance)) {
        return false;
      }
    }
  }

  return true;
}
