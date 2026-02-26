"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export interface FolderNode {
  name: string;
  children?: FolderNode[];
}

export interface Step4Data {
  folderStructure: FolderNode | null;
  basePath: string;
}

interface Step4Props {
  data: Step4Data;
  onChange: (data: Step4Data) => void;
  projectName: string;
  clientName: string;
}

function FolderTreeItem({
  node,
  depth,
  path,
  onRename,
  onDelete,
  onAddChild,
}: {
  node: FolderNode;
  depth: number;
  path: number[];
  onRename: (path: number[], newName: string) => void;
  onDelete: (path: number[]) => void;
  onAddChild: (path: number[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);

  const handleSave = () => {
    if (editValue.trim()) {
      onRename(path, editValue.trim());
    }
    setEditing(false);
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 group hover:bg-slate-50 rounded px-1 py-0.5"
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={node.children ? "#C8FF00" : "none"}
          stroke={node.children ? "#65a30d" : "#94a3b8"}
          strokeWidth="1.5"
        >
          {node.children ? (
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          ) : (
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6" />
          )}
        </svg>

        {editing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="text-xs px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#C8FF00] flex-1"
          />
        ) : (
          <span
            className="text-xs text-slate-700 flex-1 cursor-pointer"
            onDoubleClick={() => {
              setEditValue(node.name);
              setEditing(true);
            }}
          >
            {node.name}
          </span>
        )}

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button
            type="button"
            onClick={() => onAddChild(path)}
            className="text-slate-400 hover:text-[#C8FF00] p-0.5"
            title="Add subfolder"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditValue(node.name);
              setEditing(true);
            }}
            className="text-slate-400 hover:text-blue-500 p-0.5"
            title="Rename"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {depth > 0 && (
            <button
              type="button"
              onClick={() => onDelete(path)}
              className="text-slate-400 hover:text-red-500 p-0.5"
              title="Delete"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {node.children?.map((child, i) => (
        <FolderTreeItem
          key={i}
          node={child}
          depth={depth + 1}
          path={[...path, i]}
          onRename={onRename}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}

function getNodeAtPath(root: FolderNode, path: number[]): FolderNode {
  let node = root;
  for (const i of path) {
    node = node.children![i];
  }
  return node;
}

function cloneStructure(node: FolderNode): FolderNode {
  return JSON.parse(JSON.stringify(node));
}

const DEFAULT_STRUCTURE: FolderNode = {
  name: "ProjectName_ClientName",
  children: [
    {
      name: "00_Admin",
      children: [
        { name: "Brief" },
        { name: "Contracts" },
        { name: "Invoices" },
      ],
    },
    { name: "01_References" },
    {
      name: "02_Assets",
      children: [
        { name: "Fonts" },
        { name: "Images" },
        { name: "Video" },
        { name: "Audio" },
        { name: "3D" },
      ],
    },
    {
      name: "03_Working_Files",
      children: [{ name: "AE" }, { name: "C4D" }, { name: "Houdini" }, { name: "Comps" }],
    },
    {
      name: "04_Renders",
      children: [{ name: "WIP" }, { name: "Final" }],
    },
    { name: "05_Deliverables" },
    { name: "06_Archive" },
  ],
};

export function Step4Folders({
  data,
  onChange,
  projectName,
  clientName,
}: Step4Props) {
  const initStructure = () => {
    const structure = cloneStructure(DEFAULT_STRUCTURE);
    const safeName = (projectName || "Project").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeClient = (clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
    structure.name = `${safeName}_${safeClient}`;
    onChange({ ...data, folderStructure: structure });
  };

  const handleRename = (path: number[], newName: string) => {
    if (!data.folderStructure) return;
    const clone = cloneStructure(data.folderStructure);
    if (path.length === 0) {
      clone.name = newName;
    } else {
      const node = getNodeAtPath(clone, path);
      node.name = newName;
    }
    onChange({ ...data, folderStructure: clone });
  };

  const handleDelete = (path: number[]) => {
    if (!data.folderStructure || path.length === 0) return;
    const clone = cloneStructure(data.folderStructure);
    const parentPath = path.slice(0, -1);
    const childIndex = path[path.length - 1];
    const parent =
      parentPath.length === 0 ? clone : getNodeAtPath(clone, parentPath);
    if (parent.children) {
      parent.children.splice(childIndex, 1);
    }
    onChange({ ...data, folderStructure: clone });
  };

  const handleAddChild = (path: number[]) => {
    if (!data.folderStructure) return;
    const clone = cloneStructure(data.folderStructure);
    const parent =
      path.length === 0 ? clone : getNodeAtPath(clone, path);
    if (!parent.children) parent.children = [];
    parent.children.push({ name: "New_Folder" });
    onChange({ ...data, folderStructure: clone });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">
          Folder Structure
        </h3>
        <p className="text-xs text-slate-500">
          Suggested folder structure for your project. Double-click to rename,
          hover for actions.
        </p>
      </div>

      {!data.folderStructure ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
          <p className="text-xs text-slate-400 mb-3">
            Generate a folder structure based on your project type
          </p>
          <Button size="sm" onClick={initStructure}>
            Generate Structure
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 p-3 bg-white max-h-72 overflow-y-auto">
            <FolderTreeItem
              node={data.folderStructure}
              depth={0}
              path={[]}
              onRename={handleRename}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Base Path (for local folder creation)
            </label>
            <input
              type="text"
              value={data.basePath}
              onChange={(e) => onChange({ ...data, basePath: e.target.value })}
              placeholder="e.g., D:\Projects\ or /Volumes/Projects/"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
            />
            <p className="text-[10px] text-slate-400">
              Optional. If provided, you can create these folders on disk after
              project creation.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={initStructure}
            >
              Reset to Default
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
