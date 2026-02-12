import { ListTreeIcon, TagsIcon } from "lucide-react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import type { MemoExplorerContext } from "@/components/MemoExplorer";
import { cn } from "@/lib/utils";
import type { StatisticsData } from "@/types/statistics";
import TreeView from "./TreeView";

export type SidebarMode = "explorer" | "tree";

interface Props {
  className?: string;
  context: MemoExplorerContext;
  statisticsData: StatisticsData;
  tagCount: Record<string, number>;
}

const TreeSidebar = ({ className }: Props) => {
  return (
    <aside
      className={cn(
        "relative w-full h-full overflow-auto flex flex-col justify-start items-start bg-background text-sidebar-foreground",
        className,
      )}
    >
      <TreeView className="px-1" />
    </aside>
  );
};

export function useSidebarMode() {
  return useLocalStorage<SidebarMode>("sidebar-mode", "explorer");
}

export function SidebarModeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useSidebarMode();

  return (
    <div className={cn("flex flex-row gap-0.5 p-0.5 rounded-md bg-muted", className)}>
      <button
        type="button"
        className={cn(
          "flex items-center justify-center w-7 h-6 rounded-sm transition-colors",
          mode === "explorer" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setMode("explorer")}
        title="Explorer view"
      >
        <TagsIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "flex items-center justify-center w-7 h-6 rounded-sm transition-colors",
          mode === "tree" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setMode("tree")}
        title="Tree view"
      >
        <ListTreeIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default TreeSidebar;
