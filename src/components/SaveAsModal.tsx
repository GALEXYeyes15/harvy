import { ChevronDown, Folder } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";
import { fileNameFromPath, normalizeMarkdownSavePath } from "../features/save/saveRuntime";
import { joinPath, splitFileBaseAndExtension } from "../features/workspace/folderNaming";

/** `file` = single file in chosen folder; `folder` = nested folder + file inside (package). */
export type SaveAsOrganizeMode = "file" | "folder";

type SaveAsModalProps = {
  open: boolean;
  onClose: () => void;
  initialFileName: string;
  destinationPath: string | null;
  /** Short label for the Where control (e.g. folder basename). */
  destinationDisplay: string;
  isSubmitting: boolean;
  onPickDestination: () => void | Promise<void>;
  onSave: (payload: { fileName: string; organize: SaveAsOrganizeMode }) => void | Promise<void>;
};

const LABEL_COL = "w-[4.75rem] shrink-0 pt-2.5 text-right text-[12px] font-medium tracking-wide text-muted/72";

/** Unified 1px stroke for Save As modal controls (see design: #6f6f6f). */
const MODAL_STROKE = "border border-[#6f6f6f]";

const FIELD = `h-11 w-full min-w-0 rounded-[10px] ${MODAL_STROKE} bg-ink/[0.04] px-3.5 text-[14px] font-medium text-ink/92 shadow-inner shadow-ink/[0.03] outline-none transition-[border-color,box-shadow] placeholder:text-muted/40 dark:bg-ink/[0.07]`;

/** Override global `input:focus-visible` ring; keep field calm with inset + slight border shift only. */
const SAVE_AS_FILENAME_FOCUS =
  "focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#7d7d7d] focus-visible:shadow-[inset_0_1px_2px_rgba(28,25,23,0.04)] dark:focus-visible:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]";

const RADIO_CARD_BASE = `flex w-full cursor-pointer items-start gap-3 rounded-[10px] ${MODAL_STROKE} px-3.5 py-3 text-left transition-[background-color,box-shadow]`;

const RADIO_CARD_UNSELECTED = "bg-ink/[0.02] hover:bg-ink/[0.04] dark:bg-ink/[0.04] dark:hover:bg-ink/[0.06]";

const RADIO_CARD_SELECTED = "bg-ink/[0.06] dark:bg-ink/[0.08]";

export function SaveAsModal({
  open,
  onClose,
  initialFileName,
  destinationPath,
  destinationDisplay,
  isSubmitting,
  onPickDestination,
  onSave,
}: SaveAsModalProps) {
  const [fileName, setFileName] = useState("");
  const [organize, setOrganize] = useState<SaveAsOrganizeMode>("file");
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const saveAsFieldId = useId();
  const whereFieldId = useId();
  const orgGroupId = useId();

  useEffect(() => {
    if (!open) return;
    setFileName(initialFileName);
    setOrganize("file");
    requestAnimationFrame(() => {
      fileNameInputRef.current?.focus();
      fileNameInputRef.current?.select();
    });
  }, [open, initialFileName]);

  const previewLeaf = useMemo(() => {
    const t = fileName.trim();
    if (!t) return "Untitled.md";
    return fileNameFromPath(normalizeMarkdownSavePath(joinPath("x", t)));
  }, [fileName]);

  const previewBase = useMemo(() => {
    const { base } = splitFileBaseAndExtension(previewLeaf);
    return base || "Untitled";
  }, [previewLeaf]);

  const destLabel = destinationPath ? destinationDisplay : "…";

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSave = () => {
    if (isSubmitting) return;
    void onSave({ fileName: fileName.trim(), organize });
  };

  return (
    <CenteredOverlayModal
      open={open}
      onClose={handleClose}
      title="Save As"
      titleId="harvy-save-as-title"
      backdropLabel="Dismiss Save As"
      closeLabel="Close Save As"
      autoFocusCloseButton={false}
      showHeaderClose={false}
      maxWidthClass="max-w-[min(520px,calc(100vw-2rem))]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1"
    >
      <div className="flex flex-col gap-6">
        <div className="flex gap-4">
          <label htmlFor={saveAsFieldId} className={LABEL_COL}>
            Save As:
          </label>
          <div className="min-w-0 flex-1">
            <input
              ref={fileNameInputRef}
              id={saveAsFieldId}
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className={`${FIELD} ${SAVE_AS_FILENAME_FOCUS}`}
              autoComplete="off"
              spellCheck={false}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <span id={whereFieldId} className={LABEL_COL}>
            Where:
          </span>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              aria-labelledby={whereFieldId}
              disabled={isSubmitting}
              onClick={() => void onPickDestination()}
              className={`flex ${FIELD} items-center gap-2.5 text-left font-normal`}
            >
              <Folder size={17} strokeWidth={1.5} className="shrink-0 text-muted/55" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink/88">{destinationDisplay}</span>
              <ChevronDown size={17} strokeWidth={1.5} className="shrink-0 text-muted/45" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p
            id={orgGroupId}
            className="inline-flex w-fit rounded-md bg-mist/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/58 dark:bg-ink/[0.06]"
          >
            Organize my project as:
          </p>

          <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby={orgGroupId}>
            <button
              type="button"
              role="radio"
              aria-checked={organize === "file"}
              disabled={isSubmitting}
              onClick={() => setOrganize("file")}
              className={`${RADIO_CARD_BASE} ${organize === "file" ? RADIO_CARD_SELECTED : RADIO_CARD_UNSELECTED}`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${MODAL_STROKE} ${
                  organize === "file" ? "bg-page" : "bg-transparent"
                }`}
                aria-hidden
              >
                {organize === "file" ? (
                  <span className="h-2 w-2 rounded-full bg-ink/70 dark:bg-page" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink/88">
                <span className="font-medium text-ink/92">File</span>
                <span className="text-muted/62">
                  {" "}
                  – /{destLabel} / {previewLeaf}
                </span>
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={organize === "folder"}
              disabled={isSubmitting}
              onClick={() => setOrganize("folder")}
              className={`${RADIO_CARD_BASE} ${organize === "folder" ? RADIO_CARD_SELECTED : RADIO_CARD_UNSELECTED}`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${MODAL_STROKE} ${
                  organize === "folder" ? "bg-page" : "bg-transparent"
                }`}
                aria-hidden
              >
                {organize === "folder" ? (
                  <span className="h-2 w-2 rounded-full bg-ink/70 dark:bg-page" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink/88">
                <span className="font-medium text-ink/92">Folder</span>
                <span className="text-muted/62">
                  {" "}
                  – /{destLabel} / {previewBase} / {previewLeaf}
                </span>
              </span>
            </button>
          </div>
        </div>

        {!destinationPath ? (
          <p className="text-[11px] leading-relaxed text-muted/62">Choose a destination with Where before saving.</p>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-5">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-10 rounded-lg px-3 text-[13px] font-medium text-muted/88 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-55"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !destinationPath || !fileName.trim()}
            className="h-10 rounded-lg bg-white px-5 text-[13px] font-semibold text-ink shadow-sm transition-opacity hover:opacity-92 active:opacity-88 disabled:cursor-not-allowed disabled:opacity-45 dark:text-page"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </CenteredOverlayModal>
  );
}
