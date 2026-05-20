// Copie locale de supabase/functions/audio-generation-worker/parse-dialogue.ts.
// Duplication contrôlée pour isoler le pipeline journal news du pipeline
// formations — toute itération doit être appliquée aux deux copies.

export const VOICE_IDS = {
  sophie: "t8BrjWUT5Z23DLLBzbuY",
  martin: "ohItIVrXTBI80RrUECOD",
} as const;

export type Speaker = keyof typeof VOICE_IDS;

export interface DialogueInput {
  voice_id: string;
  text: string;
  speaker?: Speaker;
}

const SPEAKER_LINE_RE = /^(sophie|martin)\s*:\s*(.*)$/i;

export function parseDialogueScript(text: string): DialogueInput[] {
  if (!text) return [];

  const out: DialogueInput[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;

    const m = SPEAKER_LINE_RE.exec(line);
    if (!m) continue;

    const speakerRaw = m[1].toLowerCase();
    const speaker: Speaker = speakerRaw === "sophie" ? "sophie" : "martin";
    const replyText = m[2].trim();
    if (replyText.length === 0) continue;

    out.push({
      voice_id: VOICE_IDS[speaker],
      text: replyText,
      speaker,
    });
  }

  return out;
}

export interface ScriptStats {
  repliques: number;
  chars: number;
}

export function computeScriptStats(inputs: DialogueInput[]): ScriptStats {
  const chars = inputs.reduce((acc, i) => acc + i.text.length, 0);
  return {
    repliques: inputs.length,
    chars,
  };
}
