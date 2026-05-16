// Port Deno de src/lib/audio-generation/chunk-dialogue.ts.

import type { DialogueInput } from "./parse-dialogue.ts";

export function splitIntoChunks(
  inputs: DialogueInput[],
  maxChars: number,
): DialogueInput[][] {
  const chunks: DialogueInput[][] = [];
  let current: DialogueInput[] = [];
  let currentChars = 0;

  for (const input of inputs) {
    const len = input.text.length;

    if (current.length > 0 && currentChars + len > maxChars) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(input);
    currentChars += len;
  }

  if (current.length > 0) chunks.push(current);

  return chunks;
}
