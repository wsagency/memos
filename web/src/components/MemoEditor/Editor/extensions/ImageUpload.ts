import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export interface ImageUploadOptions {
  onUpload: (file: File) => Promise<string | null>;
}

const imageUploadPluginKey = new PluginKey("imageUpload");

const ImageUpload = Extension.create<ImageUploadOptions>({
  name: "imageUpload",

  addOptions() {
    return {
      onUpload: async () => null,
    };
  },

  addProseMirrorPlugins() {
    const { onUpload } = this.options;
    const editor = this.editor;

    return [
      new Plugin({
        key: imageUploadPluginKey,
        props: {
          handleDOMEvents: {
            drop: (view: EditorView, event: DragEvent) => {
              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return false;

              const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
              if (imageFiles.length === 0) return false;

              event.preventDefault();

              for (const file of imageFiles) {
                onUpload(file).then((url) => {
                  if (url) {
                    editor.chain().focus().setImage({ src: url }).run();
                  }
                });
              }

              return true;
            },
          },
          handlePaste: (view: EditorView, event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return false;

            const imageItems = Array.from(items).filter((item) => item.type.startsWith("image/"));
            if (imageItems.length === 0) return false;

            event.preventDefault();

            for (const item of imageItems) {
              const file = item.getAsFile();
              if (!file) continue;

              onUpload(file).then((url) => {
                if (url) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              });
            }

            return true;
          },
        },
      }),
    ];
  },
});

export default ImageUpload;
