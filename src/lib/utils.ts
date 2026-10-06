import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Splits text into overlapping chunks to preserve context.
 */
export function chunkText(text: string, size: number = 15000, overlap: number = 2000): string[] {
  if (text.length <= size) return [text];
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    start += size - overlap;
    
    // Safety break for edge cases
    if (start >= text.length - overlap && start < text.length) {
        chunks.push(text.slice(start));
        break;
    }
  }
  
  return chunks;
}

/**
 * Creates overlapping chunks with word-based boundaries (for deep analysis).
 * @param text - Full document text
 * @param wordsPerChunk - Target words per chunk (default 3000)
 * @param overlapWords - Overlap words between chunks (default 200)
 */
export function createOverlappingChunks(
  text: string,
  wordsPerChunk: number = 3000,
  overlapWords: number = 200
): string[] {
  const words = text.split(/\s+/);
  
  if (words.length <= wordsPerChunk) {
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push(words.slice(start, end).join(' '));
    
    // Move forward by (wordsPerChunk - overlapWords) to create overlap
    start += wordsPerChunk - overlapWords;
    
    // Stop if we've covered the whole document
    if (end >= words.length) break;
  }
  
  return chunks;
}
