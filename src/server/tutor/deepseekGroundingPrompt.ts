import type { TutorGroundingContext } from "./schemas";

export function buildGroundingSection(groundingContext?: TutorGroundingContext): string {
  if (!groundingContext || groundingContext.mode === "none" || groundingContext.chunks.length === 0) {
    return "";
  }

  const customInstruction = groundingContext.instruction.trim();
  const sourceBlocks = groundingContext.chunks
    .map(
      (chunk) =>
        `[SOURCE ${chunk.sourceId} chunkIndex=${chunk.chunkIndex}]\n${chunk.text}\n[/SOURCE]`
    )
    .join("\n\n");

  return [
    "",
    "---",
    "The following learning-material was extracted from the learner's uploaded file and retrieved for this question.",
    "Answer directly from this content — do not say you cannot see the file or PDF.",
    "If the extracted text does not contain the answer, say what is missing instead of inventing.",
    "Do not expose source IDs or chunk references inside the answer body.",
    "Visual limitation (state only when directly relevant): current analysis is text-based; visual diagrams and circuits are not analysed at this time.",
    ...(customInstruction ? ["", customInstruction] : []),
    "",
    sourceBlocks,
    "---",
  ].join("\n");
}
