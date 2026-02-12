import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useEditor, EditorContent as TiptapEditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Markdown } from "tiptap-markdown";
import { common, createLowlight } from "lowlight";
import { matchPath } from "react-router-dom";
import { useTagCounts } from "@/hooks/useUserQueries";
import { Routes } from "@/router";
import { cn } from "@/lib/utils";
import { EDITOR_HEIGHT } from "../constants";
import type { EditorProps } from "../types";
import type { EditorRefActions } from "./index";
import { TiptapToolbar, TiptapBubbleMenu } from "../Toolbar/TiptapToolbar";
import SlashCommand from "./extensions/SlashCommand";
import TagMention from "./extensions/TagMention";
import ImageUpload from "./extensions/ImageUpload";
import "./tiptap.css";

const lowlight = createLowlight(common);

interface TiptapEditorProps extends EditorProps {
  onImageUpload?: (file: File) => Promise<string | null>;
}

const TiptapEditor = forwardRef<EditorRefActions, TiptapEditorProps>(function TiptapEditor(props, ref) {
  const {
    className,
    initialContent,
    placeholder,
    onContentChange: handleContentChangeCallback,
    onPaste,
    isFocusMode,
    onImageUpload,
  } = props;

  const isExplorePage = Boolean(matchPath(Routes.EXPLORE, window.location.pathname));
  const { data: tagCount = {} } = useTagCounts(!isExplorePage);

  const sortedTags = useMemo(() => {
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [tagCount]);

  // Track whether content update is from internal Tiptap editing or external setContent
  const isInternalUpdate = useRef(false);
  const contentCallbackRef = useRef(handleContentChangeCallback);
  contentCallbackRef.current = handleContentChangeCallback;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Use CodeBlockLowlight instead
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write your memo here...",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Underline,
      Highlight,
      TextStyle,
      Color,
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      SlashCommand,
      TagMention.configure({
        getTags: () => sortedTags,
      }),
      ImageUpload.configure({
        onUpload: onImageUpload || (async () => null),
      }),
    ],
    content: initialContent || "",
    onUpdate: ({ editor: e }) => {
      isInternalUpdate.current = true;
      const md = e.storage.markdown?.getMarkdown() ?? "";
      contentCallbackRef.current(md);
      isInternalUpdate.current = false;
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  // Sync initialContent when it changes externally (e.g., reset after save)
  useEffect(() => {
    if (!editor || isInternalUpdate.current) return;

    const currentMd = editor.storage.markdown?.getMarkdown() ?? "";
    if (currentMd !== initialContent) {
      editor.commands.setContent(initialContent || "");
    }
  }, [initialContent, editor]);

  // Update tag mention extension when tags change
  useEffect(() => {
    if (!editor) return;
    // The getTags function is captured by closure, so sortedTags updates are reflected
  }, [sortedTags, editor]);

  const getMarkdown = useCallback((): string => {
    if (!editor) return "";
    return editor.storage.markdown?.getMarkdown() ?? "";
  }, [editor]);

  const editorActions: EditorRefActions = useMemo(
    () => ({
      getEditor: () => null, // Tiptap doesn't use HTMLTextAreaElement
      focus: () => editor?.commands.focus(),
      scrollToCursor: () => {
        // Tiptap handles scrolling internally via ProseMirror
        editor?.commands.focus();
      },
      insertText: (content = "", prefix = "", suffix = "") => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        const selected = editor.state.doc.textBetween(from, to) || content;
        const text = prefix + selected + suffix;
        editor.chain().focus().deleteRange({ from, to }).insertContent(text).run();
      },
      removeText: (start: number, length: number) => {
        if (!editor) return;
        editor.chain().focus().deleteRange({ from: start, to: start + length }).run();
      },
      setContent: (text: string) => {
        if (!editor) return;
        editor.commands.setContent(text || "");
      },
      getContent: () => getMarkdown(),
      getSelectedContent: () => {
        if (!editor) return "";
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to);
      },
      getCursorPosition: () => {
        if (!editor) return 0;
        return editor.state.selection.from;
      },
      setCursorPosition: (startPos: number, endPos?: number) => {
        if (!editor) return;
        const end = endPos ?? startPos;
        const docSize = editor.state.doc.content.size;
        const safeStart = Math.min(startPos, docSize);
        const safeEnd = Math.min(end, docSize);
        editor.chain().focus().setTextSelection({ from: safeStart, to: safeEnd }).run();
      },
      getCursorLineNumber: () => {
        if (!editor) return 0;
        const md = getMarkdown();
        const { from } = editor.state.selection;
        // Approximate: count newlines in text content up to cursor position
        const textBefore = editor.state.doc.textBetween(0, from);
        return textBefore.split("\n").length - 1;
      },
      getLine: (lineNumber: number) => {
        const md = getMarkdown();
        return md.split("\n")[lineNumber] ?? "";
      },
      setLine: (lineNumber: number, text: string) => {
        if (!editor) return;
        const md = getMarkdown();
        const lines = md.split("\n");
        lines[lineNumber] = text;
        editor.commands.setContent(lines.join("\n"));
      },
    }),
    [editor, getMarkdown],
  );

  useImperativeHandle(ref, () => editorActions, [editorActions]);

  return (
    <div
      className={cn(
        "flex flex-col justify-start items-start relative w-full bg-inherit",
        isFocusMode ? "flex-1" : `h-auto ${EDITOR_HEIGHT.normal}`,
        className,
      )}
    >
      <TiptapToolbar editor={editor} />
      <div
        className={cn(
          "w-full my-1 overflow-x-hidden overflow-y-auto bg-transparent",
          isFocusMode ? "flex-1 h-0" : "h-full",
        )}
      >
        <TiptapBubbleMenu editor={editor} />
        <TiptapEditorContent editor={editor} className="w-full" />
      </div>
    </div>
  );
});

export default TiptapEditor;
