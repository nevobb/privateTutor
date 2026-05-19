import type { TutorGroundingContext } from "./schemas";

export function buildGroundingSection(groundingContext?: TutorGroundingContext): string {
  if (!groundingContext || groundingContext.mode === "none" || groundingContext.chunks.length === 0) {
    return "";
  }

  const sourceBlocks = groundingContext.chunks
    .map(
      (chunk) =>
        `[SOURCE ${chunk.sourceId} chunkIndex=${chunk.chunkIndex}]\n${chunk.text}\n[/SOURCE]`
    )
    .join("\n\n");

  return [
    "",
    "---",
    "You may use the following retrieved learning-material excerpts.",
    "Treat them as internal course material, not as general web facts.",
    "If the excerpts do not answer the question, say what is missing instead of inventing.",
    "Cite the relevant source ids when useful.",
    "",
    sourceBlocks,
    "---",
  ].join("\n");
}
