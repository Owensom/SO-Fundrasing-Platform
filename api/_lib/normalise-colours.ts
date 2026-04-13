export type InputColour = {
  name?: unknown;
  hex?: unknown;
};

export type NormalisedColour = {
  name: string;
  hex: string;
};

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function normaliseColours(input: unknown): NormalisedColour[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const colour = item as InputColour;

      const name =
        typeof colour?.name === "string" ? colour.name.trim() : "";
      const hex =
        typeof colour?.hex === "string" ? colour.hex.trim() : "";

      if (!name || !HEX_RE.test(hex)) {
        return null;
      }

      return {
        name,
        hex: hex.toUpperCase(),
      };
    })
    .filter(Boolean) as NormalisedColour[];
}
