import { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderKanban, FileCode } from 'lucide-react';
import type { FileNode } from '../../../types/agentstudio';

export default function FileNodeComponent({ node, depth }: { node: FileNode; depth: number }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const indent = depth * 16;

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className="agentstudio-file-item folder"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {node.children ? (
            <Folder size={14} className="text-[var(--icon-file)]" />
          ) : (
            <FolderKanban size={14} className="text-[var(--icon-file)]" />
          )}
          <span>{node.name}</span>
        </div>
        {isExpanded && node.children && (
          <div className="agentstudio-file-children">
            {node.children.map((child) => (
              <FileNodeComponent key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="agentstudio-file-item file" style={{ paddingLeft: `${indent + 24}px` }}>
      <FileCode size={14} className="text-[var(--icon-code)]" />
      <span>{node.name}</span>
    </div>
  );
}
