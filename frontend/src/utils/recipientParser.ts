export type ParsedRecipients = {
  recipients: string[];
  invalidEntries: string[];
  duplicateCount: number;
  detectedCount: number;
};

const strictEmailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const extractEmailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const cleanToken = (token: string) =>
  token.trim().replace(/^[<({[\s"'`]+|[>)}\]\s"',`]+$/g, "");

export const parseRecipientInput = (input: string): ParsedRecipients => {
  const validMatches = input.match(extractEmailPattern) ?? [];
  const uniqueRecipients = new Map<string, string>();
  let duplicateCount = 0;

  for (const match of validMatches) {
    const normalized = match.toLowerCase();

    if (uniqueRecipients.has(normalized)) {
      duplicateCount += 1;
      continue;
    }

    uniqueRecipients.set(normalized, normalized);
  }

  const invalidEntries = Array.from(
    new Set(
      input
        .split(/[\s,;\n\r\t]+/)
        .map(cleanToken)
        .filter((token) => token.includes("@") && !strictEmailPattern.test(token))
    )
  );

  return {
    recipients: Array.from(uniqueRecipients.values()),
    invalidEntries,
    duplicateCount,
    detectedCount: validMatches.length
  };
};
