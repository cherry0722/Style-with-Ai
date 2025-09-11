import { OutfitTemplate } from "../types";

const topOutfits: OutfitTemplate[] = [
  {
    id: "date1",
    context: "date-night",
    recipe: ["top", "bottom", "shoes", "accessory"],
    preferredColors: {
      top: ["black", "white", "red"],
      bottom: ["black", "gray", "blue"],
      shoes: ["black", "white"],
    },
  },
  {
    id: "date2",
    context: "date-night",
    recipe: ["dress", "shoes", "accessory"],
    preferredColors: { shoes: ["black", "beige"], accessory: ["gold", "black"] as any },
  },
  {
    id: "casual1",
    context: "casual",
    recipe: ["top", "bottom", "shoes"],
  },
];

export default topOutfits;