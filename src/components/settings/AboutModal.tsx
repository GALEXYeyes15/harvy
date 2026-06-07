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
      titleId="about-dialog-title"
      backdropLabel="Dismiss about"
      closeLabel="Close about"
      maxWidthClass="max-w-[min(520px,calc(100vw-3rem))]"
    >
      <AboutModalContent />
    </CenteredOverlayModal>
  );
}
