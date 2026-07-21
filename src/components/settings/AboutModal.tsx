import { CenteredOverlayModal } from "../overlay/CenteredOverlayModal";
import { AboutModalContent } from "./AboutModalContent";

type AboutModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AboutModal({ open, onClose }: AboutModalProps) {
  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title="Tribute"
      titleId="tribute-dialog-title"
      backdropLabel="Dismiss tribute"
      closeLabel="Close tribute"
      panelSizeClassName="h-[min(500px,90vh)] w-[min(700px,90vw)] max-h-[90vh] max-w-[90vw]"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-5 pt-2"
    >
      <AboutModalContent />
    </CenteredOverlayModal>
  );
}
