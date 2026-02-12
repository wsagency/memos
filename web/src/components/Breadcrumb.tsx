import { ChevronRightIcon, HomeIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { memoNamePrefix } from "@/helpers/resource-names";
import { useMemo as useReactMemo } from "react";
import { useMemos } from "@/hooks/useMemoQueries";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { cn } from "@/lib/utils";

interface Props {
  memo: Memo;
  className?: string;
}

function getMemoTitle(memo: Memo): string {
  const firstLine = memo.content.split("\n")[0] || "";
  return firstLine.replace(/^#+\s*/, "").replace(/^📁\s*/, "").trim() || memo.snippet || "Untitled";
}

const Breadcrumb = ({ memo, className }: Props) => {
  const { data: memosResponse } = useMemos({
    pageSize: 1000,
    state: State.NORMAL,
  });

  const breadcrumbs = useReactMemo(() => {
    const allMemos = memosResponse?.memos || [];
    const memoMap = new Map<string, Memo>();
    const childToParent = new Map<string, string>();

    for (const m of allMemos) {
      memoMap.set(m.name, m);
    }

    // Build parent map from PARENT relations
    for (const m of allMemos) {
      for (const relation of m.relations) {
        if (relation.type === MemoRelation_Type.PARENT) {
          const childName = relation.memo?.name;
          const parentName = relation.relatedMemo?.name;
          if (childName && parentName) {
            childToParent.set(childName, parentName);
          }
        }
      }
    }

    // Walk up the tree
    const path: { name: string; title: string }[] = [];
    let current = memo.name;
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      visited.add(current);
      const parentName = childToParent.get(current);
      if (parentName && memoMap.has(parentName)) {
        const parentMemo = memoMap.get(parentName)!;
        path.unshift({ name: parentMemo.name, title: getMemoTitle(parentMemo) });
        current = parentName;
      } else {
        break;
      }
    }

    return path;
  }, [memo.name, memosResponse]);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className={cn("flex flex-row items-center gap-1 text-xs text-muted-foreground", className)}>
      <Link to="/" className="hover:text-primary transition-colors" viewTransition>
        <HomeIcon className="w-3.5 h-3.5" />
      </Link>
      {breadcrumbs.map((crumb) => (
        <span key={crumb.name} className="flex items-center gap-1">
          <ChevronRightIcon className="w-3 h-3" />
          <Link to={`/${crumb.name}`} className="hover:text-primary transition-colors truncate max-w-32" viewTransition>
            {crumb.title}
          </Link>
        </span>
      ))}
      <ChevronRightIcon className="w-3 h-3" />
      <span className="text-foreground truncate max-w-48">{getMemoTitle(memo)}</span>
    </nav>
  );
};

export default Breadcrumb;
