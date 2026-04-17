const colours = Array.isArray(config.colours)
  ? config.colours.map((colour: any, index: number) => {
      if (typeof colour === "string") {
        return {
          id: colour,
          name: colour,
          hex: null,
          sortOrder: index,
        };
      }

      const fallbackName =
        colour?.name ||
        colour?.label ||
        colour?.value ||
        colour?.id ||
        `Colour ${index + 1}`;

      return {
        id: colour?.id ?? `colour-${index}`,
        name: String(fallbackName),
        hex: colour?.hex ?? null,
        sortOrder: Number(colour?.sortOrder ?? index),
      };
    })
  : [];
