import { Extension } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Editor, Range } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";

interface TagListProps {
  items: string[];
  command: (item: string) => void;
}

function TagList({ items, command }: TagListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ items, command });
  propsRef.current = { items, command };

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useLayoutEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as HTMLDivElement & { onKeyDown: (e: KeyboardEvent) => boolean }).onKeyDown = (event: KeyboardEvent) => {
        const { items: currentItems, command: currentCommand } = propsRef.current;
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + currentItems.length) % currentItems.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % currentItems.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          setSelectedIndex((currentIdx) => {
            const item = currentItems[currentIdx];
            if (item) currentCommand(item);
            return currentIdx;
          });
          return true;
        }
        return false;
      };
    }
  }, []);

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="tiptap-slash-popup">
      {items.map((tag, index) => (
        <div
          key={tag}
          ref={index === selectedIndex ? selectedRef : null}
          className={`tiptap-slash-item ${index === selectedIndex ? "is-selected" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            command(tag);
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="text-muted-foreground mr-1">#</span>
          <span className="truncate">{tag}</span>
        </div>
      ))}
    </div>
  );
}

export interface TagMentionOptions {
  getTags: () => string[];
}

const TagMention = Extension.create<TagMentionOptions>({
  name: "tagMention",

  addOptions() {
    return {
      getTags: () => [],
      suggestion: {
        char: "#",
        // Allow # to trigger after whitespace or at start of line
        allowSpaces: false,
        command: ({ editor, range, props: tag }: { editor: Editor; range: Range; props: string }) => {
          // Insert the tag as plain text (markdown-compatible)
          editor.chain().focus().deleteRange(range).insertContent(`#${tag} `).run();
        },
        items: ({ query }: { query: string }): string[] => {
          const tags = (this as unknown as { options: TagMentionOptions }).options.getTags();
          const q = query.toLowerCase();
          return q ? tags.filter((tag) => tag.toLowerCase().includes(q)).slice(0, 20) : tags.slice(0, 20);
        },
        render: () => {
          let container: HTMLDivElement | null = null;
          let root: ReturnType<typeof createRoot> | null = null;

          return {
            onStart: (props: SuggestionProps<string>) => {
              container = document.createElement("div");
              container.style.position = "fixed";
              container.style.zIndex = "50";

              const rect = props.clientRect?.();
              if (rect) {
                container.style.left = `${rect.left}px`;
                container.style.top = `${rect.bottom}px`;
              }

              document.body.appendChild(container);
              root = createRoot(container);
              root.render(<TagList items={props.items} command={(item) => props.command(item)} />);
            },
            onUpdate: (props: SuggestionProps<string>) => {
              const rect = props.clientRect?.();
              if (container && rect) {
                container.style.left = `${rect.left}px`;
                container.style.top = `${rect.bottom}px`;
              }
              root?.render(<TagList items={props.items} command={(item) => props.command(item)} />);
            },
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              if (event.key === "Escape") {
                container?.remove();
                root?.unmount();
                container = null;
                root = null;
                return true;
              }
              const el = container?.firstElementChild as HTMLDivElement & { onKeyDown?: (e: KeyboardEvent) => boolean };
              if (el?.onKeyDown) {
                return el.onKeyDown(event);
              }
              return false;
            },
            onExit: () => {
              root?.unmount();
              container?.remove();
              container = null;
              root = null;
            },
          };
        },
      } satisfies Partial<Parameters<typeof Suggestion>[0]>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...(this.options as unknown as { suggestion: Parameters<typeof Suggestion>[0] }).suggestion,
      }),
    ];
  },
});

export default TagMention;
