import { Extension } from "@tiptap/react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Editor, Range } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import {
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  QuoteIcon,
  TableIcon,
} from "lucide-react";

export interface SlashCommandItem {
  title: string;
  icon: ReactNode;
  command: (editor: Editor, range: Range) => void;
}

const slashCommands: SlashCommandItem[] = [
  {
    title: "Heading 1",
    icon: <Heading1Icon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    icon: <Heading2Icon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    icon: <Heading3Icon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    icon: <ListIcon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Ordered List",
    icon: <ListOrderedIcon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    icon: <ListTodoIcon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Code Block",
    icon: <CodeIcon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Blockquote",
    icon: <QuoteIcon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Table",
    icon: <TableIcon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: "Image",
    icon: <ImageIcon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      const url = window.prompt("Image URL");
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
  {
    title: "Divider",
    icon: <MinusIcon className="tiptap-slash-item-icon" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

function SlashCommandList({ items, command }: SlashCommandListProps) {
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

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
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
    if (event.key === "Enter") {
      event.preventDefault();
      // Use functional state to read latest selectedIndex
      setSelectedIndex((currentIdx) => {
        const item = currentItems[currentIdx];
        if (item) currentCommand(item);
        return currentIdx;
      });
      return true;
    }
    return false;
  }, []);

  // Store handler ref so the parent can call it
  useEffect(() => {
    (containerRef.current as HTMLDivElement & { _keyHandler?: (e: KeyboardEvent) => boolean })?._keyHandler !== undefined
      ? undefined
      : undefined;
  }, []);

  // Expose key handler via data attribute on the container
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as HTMLDivElement & { onKeyDown: (e: KeyboardEvent) => boolean }).onKeyDown = handleKeyDown;
    }
  }, [handleKeyDown]);

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="tiptap-slash-popup">
      {items.map((item, index) => (
        <div
          key={item.title}
          ref={index === selectedIndex ? selectedRef : null}
          className={`tiptap-slash-item ${index === selectedIndex ? "is-selected" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            command(item);
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {item.icon}
          <span>{item.title}</span>
        </div>
      ))}
    </div>
  );
}

const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({ editor, range, props: item }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
          item.command(editor, range);
        },
        items: ({ query }: { query: string }): SlashCommandItem[] => {
          const q = query.toLowerCase();
          return slashCommands.filter((item) => item.title.toLowerCase().includes(q));
        },
        render: () => {
          let container: HTMLDivElement | null = null;
          let root: ReturnType<typeof createRoot> | null = null;
          let currentProps: SuggestionProps<SlashCommandItem> | null = null;

          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              currentProps = props;
              container = document.createElement("div");
              container.style.position = "absolute";
              container.style.zIndex = "50";

              const rect = props.clientRect?.();
              if (rect) {
                container.style.left = `${rect.left}px`;
                container.style.top = `${rect.bottom}px`;
                container.style.position = "fixed";
              }

              document.body.appendChild(container);
              root = createRoot(container);
              root.render(<SlashCommandList items={props.items} command={(item) => props.command(item)} />);
            },
            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
              currentProps = props;
              const rect = props.clientRect?.();
              if (container && rect) {
                container.style.left = `${rect.left}px`;
                container.style.top = `${rect.bottom}px`;
              }
              root?.render(<SlashCommandList items={props.items} command={(item) => props.command(item)} />);
            },
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              if (event.key === "Escape") {
                container?.remove();
                root?.unmount();
                container = null;
                root = null;
                return true;
              }
              // Delegate to the list component's key handler
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
              currentProps = null;
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
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommand;
