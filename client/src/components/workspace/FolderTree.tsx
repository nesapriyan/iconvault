import React, { useState, useMemo } from 'react';
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Layers,
  Inbox
} from 'lucide-react';
import { Folder } from '../../types';

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId: string | null | 'all' | 'root';
  totalIconsCount: number;
  canEdit?: boolean;
  onSelectFolder: (folderId: string | null | 'all' | 'root') => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onDropIconsToFolder: (folderId: string | null, iconIds: string[]) => Promise<void>;
}

interface TreeNode extends Folder {
  children: TreeNode[];
}

export function FolderTree({
  folders,
  selectedFolderId,
  totalIconsCount,
  canEdit = true,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropIconsToFolder
}: FolderTreeProps) {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [activeMenuFolderId, setActiveMenuFolderId] = useState<string | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null | 'root'>(null);

  // Build hierarchy tree
  const tree = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>();
    folders.forEach(f => {
      nodeMap.set(f.id, { ...f, children: [] });
    });

    const roots: TreeNode[] = [];
    nodeMap.forEach(node => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [folders]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim(), newFolderParentId ?? null);
    setNewFolderName('');
    setNewFolderParentId(undefined);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !editingFolder.name.trim()) return;
    await onRenameFolder(editingFolder.id, editingFolder.name.trim());
    setEditingFolder(null);
  };

  // Drag and drop icon onto folder
  const handleDragOver = (e: React.DragEvent, folderId: string | null | 'root') => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;

    try {
      const { iconIds } = JSON.parse(rawData);
      if (Array.isArray(iconIds) && iconIds.length > 0) {
        onDropIconsToFolder(targetFolderId, iconIds);
      }
    } catch {}
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isSelected = selectedFolderId === node.id;
    const isCollapsed = collapsedMap[node.id];
    const isDragOver = dragOverFolderId === node.id;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => onSelectFolder(node.id)}
          onDragOver={e => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, node.id)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
            isSelected
              ? 'bg-primary/10 text-primary font-semibold'
              : isDragOver
              ? 'bg-blue-500/20 text-blue-500 border-2 border-dashed border-blue-500'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {hasChildren ? (
              <button
                onClick={e => toggleCollapse(node.id, e)}
                className="p-0.5 hover:bg-secondary/80 rounded"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {isCollapsed ? (
              <FolderIcon className="w-4 h-4 text-blue-500 shrink-0" />
            ) : (
              <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
            )}

            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-mono bg-secondary/80 px-1.5 py-0.5 rounded-full">
              {node.icon_count}
            </span>

            {/* Folder Actions Menu */}
            {canEdit && (
              <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setActiveMenuFolderId(activeMenuFolderId === node.id ? null : node.id);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {activeMenuFolderId === node.id && (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="absolute right-0 top-6 z-30 w-36 bg-card border border-border rounded-xl shadow-xl p-1 text-xs"
                  >
                    <button
                      onClick={() => {
                        setNewFolderParentId(node.id);
                        setActiveMenuFolderId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-secondary rounded-lg text-foreground text-left"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-500" />
                      <span>Add Subfolder</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingFolder({ id: node.id, name: node.name });
                        setActiveMenuFolderId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-secondary rounded-lg text-foreground text-left"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={() => {
                        onDeleteFolder(node.id);
                        setActiveMenuFolderId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Render child folders */}
        {!isCollapsed && hasChildren && (
          <div className="space-y-0.5 mt-0.5">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 border-r border-border bg-card/40 p-4 flex flex-col justify-between shrink-0 h-full overflow-y-auto">
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Folders
          </span>
          {canEdit && (
            <button
              onClick={() => setNewFolderParentId(null)}
              className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Create Root Folder"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global navigation items */}
        <div className="space-y-0.5 mb-3">
          <button
            onClick={() => onSelectFolder('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              selectedFolderId === 'all'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span>All Icons</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono bg-secondary/80 px-1.5 py-0.5 rounded-full">
              {totalIconsCount}
            </span>
          </button>

          <button
            onClick={() => onSelectFolder('root')}
            onDragOver={e => handleDragOver(e, 'root')}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              selectedFolderId === 'root'
                ? 'bg-primary/10 text-primary font-semibold'
                : dragOverFolderId === 'root'
                ? 'bg-blue-500/20 text-blue-500 border-2 border-dashed border-blue-500'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-amber-500" />
              <span>Uncategorized</span>
            </div>
          </button>
        </div>

        {/* Hierarchical Folder Nodes */}
        <div className="space-y-0.5">
          {tree.map(node => renderNode(node, 0))}
        </div>
      </div>

      {/* New Folder Inline Form */}
      {newFolderParentId !== undefined && (
        <form onSubmit={handleCreateSubmit} className="mt-4 p-3 bg-secondary/60 rounded-xl border border-border">
          <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
            {newFolderParentId ? 'New Subfolder' : 'New Folder'}
          </div>
          <input
            type="text"
            autoFocus
            required
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            className="w-full px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setNewFolderParentId(undefined)}
              className="px-2 py-1 text-[11px] rounded hover:bg-secondary text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-primary text-white hover:bg-blue-600"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Rename Folder Modal */}
      {editingFolder && (
        <form onSubmit={handleRenameSubmit} className="mt-4 p-3 bg-secondary/60 rounded-xl border border-border">
          <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
            Rename Folder
          </div>
          <input
            type="text"
            autoFocus
            required
            value={editingFolder.name}
            onChange={e => setEditingFolder({ ...editingFolder, name: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary mb-2"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditingFolder(null)}
              className="px-2 py-1 text-[11px] rounded hover:bg-secondary text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-primary text-white hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
