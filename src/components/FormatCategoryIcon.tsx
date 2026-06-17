import { FileText, Mail, MessageSquareText, Mic, Smartphone, Video } from "lucide-react";
import type { FormatCategoryId } from "../features/format/formatCategories";

type FormatCategoryIconProps = {
  category: FormatCategoryId;
  className?: string;
};

export function FormatCategoryIcon({ category, className = "h-[18px] w-[18px]" }: FormatCategoryIconProps) {
  const props = { className, strokeWidth: 1.75, "aria-hidden": true as const };

  switch (category) {
    case "tweets_notes":
      return <MessageSquareText {...props} />;
    case "mid_form_post":
      return <FileText {...props} />;
    case "long_form_outline":
      return <Video {...props} />;
    case "short_form_outline":
      return <Smartphone {...props} />;
    case "newsletter":
      return <Mail {...props} />;
    case "podcast_notes":
      return <Mic {...props} />;
    default:
      return null;
  }
}
