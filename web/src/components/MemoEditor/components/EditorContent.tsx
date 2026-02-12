import { forwardRef, useCallback } from "react";
import { create } from "@bufbuild/protobuf";
import { attachmentServiceClient } from "@/connect";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import Editor, { type EditorRefActions } from "../Editor";
import { useBlobUrls, useDragAndDrop } from "../hooks";
import { useEditorContext } from "../state";
import type { EditorContentProps } from "../types";
import type { LocalFile } from "../types/attachment";

export const EditorContent = forwardRef<EditorRefActions, EditorContentProps>(({ placeholder }, ref) => {
  const { state, actions, dispatch } = useEditorContext();
  const { createBlobUrl } = useBlobUrls();

  const { dragHandlers } = useDragAndDrop((files: FileList) => {
    // Only handle non-image files as attachments; images are handled by TiptapEditor inline
    const nonImageFiles = Array.from(files).filter((file) => !file.type.startsWith("image/"));
    if (nonImageFiles.length === 0) return;
    const localFiles: LocalFile[] = nonImageFiles.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
  });

  const handleContentChange = (content: string) => {
    dispatch(actions.updateContent(content));
  };

  const handlePaste = (event: React.ClipboardEvent<Element>) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    // Only intercept non-image file pastes; images are handled by Tiptap's ImageUpload extension
    const files: File[] = [];
    if (clipboard.items && clipboard.items.length > 0) {
      for (const item of Array.from(clipboard.items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file && !file.type.startsWith("image/")) files.push(file);
      }
    } else if (clipboard.files && clipboard.files.length > 0) {
      const nonImageFiles = Array.from(clipboard.files).filter((f) => !f.type.startsWith("image/"));
      files.push(...nonImageFiles);
    }

    if (files.length === 0) return;

    const localFiles: LocalFile[] = files.map((file) => ({
      file,
      previewUrl: createBlobUrl(file),
    }));
    localFiles.forEach((localFile) => dispatch(actions.addLocalFile(localFile)));
    event.preventDefault();
  };

  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const attachment = await attachmentServiceClient.createAttachment({
        attachment: create(AttachmentSchema, {
          filename: file.name,
          size: BigInt(file.size),
          type: file.type,
          content: buffer,
        }),
      });
      return `${window.location.origin}/file/${attachment.name}/${attachment.filename}`;
    } catch (error) {
      console.error("Image upload failed:", error);
      return null;
    }
  }, []);

  return (
    <div className="w-full flex flex-col flex-1" {...dragHandlers}>
      <Editor
        ref={ref}
        className="memo-editor-content"
        initialContent={state.content}
        placeholder={placeholder || ""}
        isFocusMode={state.ui.isFocusMode}
        isInIME={state.ui.isComposing}
        onContentChange={handleContentChange}
        onPaste={handlePaste}
        onImageUpload={handleImageUpload}
      />
    </div>
  );
});

EditorContent.displayName = "EditorContent";
