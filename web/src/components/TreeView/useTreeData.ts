import { create } from "@bufbuild/protobuf";
import { useCallback, useMemo, useState } from "react";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { memoServiceClient } from "@/connect";
import { memoNamePrefix } from "@/helpers/resource-names";
import { useCreateMemo, useMemos } from "@/hooks/useMemoQueries";
import type { Memo, MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Type, MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";

export interface TreeNode {
  id: string;
  name: string;
  title: string;
  isFolder: boolean;
  isPinned: boolean;
  children: TreeNode[];
  parentId: string | null;
  memo?: Memo;
}

const WS_FOLDER_TAG = "ws-folder";

function getMemoTitle(memo: Memo): string {
  const firstLine = memo.content.split("\n")[0] || "";
  return firstLine.replace(/^#+\s*/, "").replace(/^📁\s*/, "").trim() || memo.snippet || "Untitled";
}

function isFolder(memo: Memo): boolean {
  return memo.tags.includes(WS_FOLDER_TAG);
}

function buildTreeFromRelations(memos: Memo[]): TreeNode[] {
  const memoMap = new Map<string, Memo>();
  const childToParent = new Map<string, string>();

  for (const memo of memos) {
    memoMap.set(memo.name, memo);
  }

  // Build parent-child map from PARENT relations
  for (const memo of memos) {
    for (const relation of memo.relations) {
      if (relation.type === MemoRelation_Type.PARENT) {
        // In a PARENT relation: memo is the child, relatedMemo is the parent
        const childName = relation.memo?.name;
        const parentName = relation.relatedMemo?.name;
        if (childName && parentName) {
          childToParent.set(childName, parentName);
        }
      }
    }
  }

  // Build tree nodes
  const nodeMap = new Map<string, TreeNode>();
  for (const memo of memos) {
    nodeMap.set(memo.name, {
      id: memo.name,
      name: memo.name,
      title: getMemoTitle(memo),
      isFolder: isFolder(memo),
      isPinned: memo.pinned,
      children: [],
      parentId: childToParent.get(memo.name) || null,
      memo,
    });
  }

  // Assemble tree
  const roots: TreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort: folders first, then pinned, then alphabetical
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

function buildTagTree(memos: Memo[], existingTree: TreeNode[]): TreeNode[] {
  // Collect memos that are NOT already in the relation-based tree
  const inTree = new Set<string>();
  const collectIds = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      inTree.add(node.id);
      collectIds(node.children);
    }
  };
  collectIds(existingTree);

  // Build tag hierarchy from remaining memos
  const tagGroups = new Map<string, TreeNode>();

  for (const memo of memos) {
    if (inTree.has(memo.name)) continue;

    // Find hierarchical tags (a/b/c)
    const hierarchicalTags = memo.tags.filter((t) => t.includes("/") && t !== WS_FOLDER_TAG);
    if (hierarchicalTags.length === 0) continue;

    for (const tag of hierarchicalTags) {
      const parts = tag.split("/");
      let currentMap = tagGroups;

      for (let i = 0; i < parts.length - 1; i++) {
        const partKey = parts.slice(0, i + 1).join("/");
        if (!currentMap.has(partKey)) {
          currentMap.set(partKey, {
            id: `tag:${partKey}`,
            name: `tag:${partKey}`,
            title: parts[i],
            isFolder: true,
            isPinned: false,
            children: [],
            parentId: null,
          });
        }
        // Navigate deeper - use children map
        const parentNode = currentMap.get(partKey)!;
        const childMap = new Map<string, TreeNode>();
        for (const child of parentNode.children) {
          childMap.set(child.id, child);
        }
        currentMap = childMap;
      }
    }
  }

  return [...existingTree, ...tagGroups.values()];
}

export function useTreeData() {
  const [expandedNodes, setExpandedNodes] = useLocalStorage<string[]>("tree-expanded-nodes", []);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: memosResponse } = useMemos({
    pageSize: 1000,
    state: State.NORMAL,
  });
  const createMemoMutation = useCreateMemo();

  const allMemos = useMemo(() => memosResponse?.memos || [], [memosResponse]);

  const treeData = useMemo(() => {
    const relationTree = buildTreeFromRelations(allMemos);
    return buildTagTree(allMemos, relationTree);
  }, [allMemos]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;

    const query = searchQuery.toLowerCase();
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map((node) => {
          const filteredChildren = filterNodes(node.children);
          const matches = node.title.toLowerCase().includes(query);
          if (matches || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter((n): n is TreeNode => n !== null);
    };
    return filterNodes(treeData);
  }, [treeData, searchQuery]);

  const toggleNode = useCallback(
    (nodeId: string) => {
      setExpandedNodes((prev = []) => (prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]));
    },
    [setExpandedNodes],
  );

  const moveNode = useCallback(
    async (childName: string, newParentName: string) => {
      // Set PARENT relation: child memo → parent memo
      const childMemo = allMemos.find((m) => m.name === childName);
      if (!childMemo) return;

      // Get existing relations, filter out old PARENT relations for this child
      const existingRelations: MemoRelation[] = childMemo.relations.filter((r) => r.type !== MemoRelation_Type.PARENT);

      // Add new PARENT relation
      await memoServiceClient.setMemoRelations({
        name: childName,
        relations: [
          ...existingRelations,
          {
            memo: { name: childName, snippet: "" },
            relatedMemo: { name: newParentName, snippet: "" },
            type: MemoRelation_Type.PARENT,
            $typeName: "memos.api.v1.MemoRelation",
          },
        ],
      });
    },
    [allMemos],
  );

  const createFolder = useCallback(
    async (name: string, parentName?: string) => {
      const folderMemo = create(MemoSchema, {
        content: `# 📁 ${name}\n\n#${WS_FOLDER_TAG}`,
        visibility: Visibility.PRIVATE,
      });

      const created = await createMemoMutation.mutateAsync(folderMemo);

      if (parentName) {
        await memoServiceClient.setMemoRelations({
          name: created.name,
          relations: [
            {
              memo: { name: created.name, snippet: "" },
              relatedMemo: { name: parentName, snippet: "" },
              type: MemoRelation_Type.PARENT,
              $typeName: "memos.api.v1.MemoRelation",
            },
          ],
        });
      }

      return created;
    },
    [createMemoMutation],
  );

  return {
    treeData: filteredTree,
    expandedNodes: expandedNodes || [],
    toggleNode,
    moveNode,
    createFolder,
    searchQuery,
    setSearchQuery,
    allMemos,
  };
}

export { WS_FOLDER_TAG, getMemoTitle, isFolder };
