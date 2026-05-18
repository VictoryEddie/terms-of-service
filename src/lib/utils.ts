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
