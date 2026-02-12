import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRightIcon, FileTextIcon, FolderIcon, FolderOpenIcon, GripVerticalIcon, MoreHorizontalIcon, PinIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import type { TreeNode as TreeNodeType } from "./useTreeData";

interface Props {
  node: TreeNodeType;
  depth: number;
  expandedNodes: string[];
  onToggle: (nodeId: string) => void;
  onCreateChild?: (parentName: string) => void;
  onCreateFolder?: (parentName: string) => void;
  onDelete?: (name: string) => void;
}

const TreeNodeComponent = ({ node, depth, expandedNodes, onToggle, onCreateChild, onCreateFolder, onDelete }: Props) => {
  const t = useTranslate();
  const [showMenu, setShowMenu] = useState(false);
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.includes(node.id);
  const isTagNode = node.id.startsWith("tag:");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: isTagNode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={cn(
          "group flex flex-row items-center gap-0.5 px-1 py-0.5 rounded-md cursor-pointer text-sm select-none",
          "hover:bg-muted/50",
          isDragging && "opacity-50",
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        {/* Drag handle */}
        {!isTagNode && (
          <span className="shrink-0 w-4 h-4 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-40" {...listeners}>
            <GripVerticalIcon className="w-3 h-3" />
          </span>
        )}

        {/* Expand/collapse toggle */}
        <button
          type="button"
          className={cn("shrink-0 w-4 h-4 flex items-center justify-center", !hasChildren && !node.isFolder && "invisible")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle(node.id);
          }}
        >
          <ChevronRightIcon className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
        </button>

        {/* Icon */}
        <span className="shrink-0 w-4 h-4 flex items-center justify-center mr-1">
          {node.isFolder ? (
            isExpanded ? (
              <FolderOpenIcon className="w-4 h-4 text-amber-500" />
            ) : (
              <FolderIcon className="w-4 h-4 text-amber-500" />
            )
          ) : (
            <FileTextIcon className="w-4 h-4 text-muted-foreground" />
          )}
        </span>

        {/* Title */}
        {isTagNode ? (
          <span className="truncate text-muted-foreground flex-1">{node.title}</span>
        ) : (
          <Link to={`/${node.name}`} className="truncate flex-1 hover:text-primary" viewTransition>
            {node.title}
          </Link>
        )}

        {/* Pinned indicator */}
        {node.isPinned && <PinIcon className="w-3 h-3 text-muted-foreground shrink-0" />}

        {/* Context menu */}
        {!isTagNode && showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0">
                <MoreHorizontalIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {node.isFolder && onCreateChild && (
                <DropdownMenuItem onClick={() => onCreateChild(node.name)}>{t("common.create")}</DropdownMenuItem>
              )}
              {node.isFolder && onCreateFolder && (
                <DropdownMenuItem onClick={() => onCreateFolder(node.name)}>New Folder</DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(node.name)}>
                  {t("common.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Children */}
      {isExpanded &&
        node.children.map((child) => (
          <TreeNodeComponent
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedNodes={expandedNodes}
            onToggle={onToggle}
            onCreateChild={onCreateChild}
            onCreateFolder={onCreateFolder}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
};

export default TreeNodeComponent;
