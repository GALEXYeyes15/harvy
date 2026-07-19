import { resolveWorkspaceImageSrc } from "../features/editor/imageAssets";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

export type ImagePreviewTarget = {
  fileName: string;
  sourcePath: string;
};

type ImagePreviewModalProps = {
  open: boolean;
  target: ImagePreviewTarget | null;
  workspaceRootPath: string | null;
  onClose: () => void;
};

export function ImagePreviewModal({
  open,
  target,
  workspaceRootPath,
  onClose,
}: ImagePreviewModalProps) {
  if (!target) return null;

  const src = resolveWorkspaceImageSrc(workspaceRootPath, target.sourcePath);

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title={target.fileName}
      titleId="harvy-image-preview-title"
      backdropLabel="Close image preview"
      closeLabel="Close image preview"
      panelSizeClassName="max-h-[min(88vh,calc(100vh-2.5rem))] w-full max-w-[min(1040px,calc(100vw-2.5rem))]"
      bodyClassName="flex min-h-0 flex-1 items-center justify-center overflow-auto px-6 pb-6 pt-1"
    >
      {src ? (
        <img
          src={src}
          alt={target.fileName}
          className="max-h-[min(72vh,calc(100vh-10rem))] max-w-full object-contain"
          draggable={false}
        />
      ) : (
        <p className="text-[14px] text-muted/75">Could not preview this image.</p>
      )}
    </CenteredOverlayModal>
  );
}
