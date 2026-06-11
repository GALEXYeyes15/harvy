export type TwitterFormatGenerationItem = {
  id: string;
  text: string;
  status: "draft" | "edited" | "favorite" | "published";
  favorite: boolean;
};

export type TwitterFormatGenerationResult = {
  platform: "twitter";
  type: "collection";
  title: string;
  items: TwitterFormatGenerationItem[];
};
