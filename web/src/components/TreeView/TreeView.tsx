import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FolderPlusIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import TreeNodeComponent from "./TreeNode";
import { useTreeData, type TreeNode } from "./useTreeData";

interface Props {
  className?: string;
}

function collectNodeIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    ids.push(...collectNodeIds(node.children));
  }
  return ids;
}

function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

const TreeView = ({ className }: Props) => {
  const t = useTranslate();
  const { treeData, expandedNodes, toggleNode, moveNode, createFolder, searchQuery, setSearchQuery } = useTreeData();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderParent, setFolderParent] = useState<string | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const allIds = useMemo(() => collectNodeIds(treeData), [treeData]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Don't allow dragging tag nodes
      if (activeId.startsWith("tag:")) return;

      const overNode = findNodeById(treeData, overId);
      if (!overNode) return;

      // Only allow dropping onto folders
      if (!overNode.isFolder) return;

      try {
        await moveNode(activeId, overId);
        toast.success("Moved successfully");
      } catch {
        toast.error("Failed to move memo");
      }
    },
    [treeData, moveNode],
  );

  const handleCreateFolder = useCallback(
    async (parentName?: string) => {
      setFolderParent(parentName);
      setNewFolderName("");
      setFolderDialogOpen(true);
    },
    [],
  );

  const handleSubmitFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim(), folderParent);
      setFolderDialogOpen(false);
      setNewFolderName("");
      toast.success("Folder created");
    } catch {
      toast.error("Failed to create folder");
    }
  }, [newFolderName, folderParent, createFolder]);

  return (
    <div className={cn("w-full flex flex-col gap-2", className)}>
      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="h-7 pl-7 text-xs"
          placeholder={t("common.search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-row gap-1">
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground" onClick={() => handleCreateFolder()}>
          <FolderPlusIcon className="w-3.5 h-3.5" />
          New Folder
        </Button>
      </div>

      {/* Folder name input dialog */}
      {folderDialogOpen && (
        <div className="flex flex-row gap-1 px-1">
          <Input
            className="h-7 text-xs flex-1"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitFolder();
              if (e.key === "Escape") setFolderDialogOpen(false);
            }}
            autoFocus
          />
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleSubmitFolder}>
            <PlusIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Tree */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col">
            {treeData.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-2 py-4">No memos found</p>
            ) : (
              treeData.map((node) => (
                <TreeNodeComponent
                  key={node.id}
                  node={node}
                  depth={0}
                  expandedNodes={expandedNodes}
                  onToggle={toggleNode}
                  onCreateFolder={(parentName) => handleCreateFolder(parentName)}
                />
              ))
            )}
          </div>
        </SortableContext>
        <DragOverlay />
      </DndContext>
    </div>
  );
};

export default TreeView;
