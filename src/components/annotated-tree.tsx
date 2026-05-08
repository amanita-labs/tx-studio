// src/components/annotated-tree.tsx
'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CBORNode } from '@/lib/cbor-annotator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AnnotatedTreeProps {
  nodes: CBORNode[];
  onNodeHover?: (node: CBORNode) => void;
  onNodeClick?: (node: CBORNode) => void;
  className?: string;
}

export function AnnotatedTree({ 
  nodes, 
  onNodeHover, 
  onNodeClick,
  className 
}: AnnotatedTreeProps) {
  return (
    <div className={cn("font-mono text-sm", className)}>
      <TooltipProvider>
        <div className="space-y-1">
          {nodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              onNodeHover={onNodeHover}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}

interface TreeNodeProps {
  node: CBORNode;
  depth: number;
  onNodeHover?: (node: CBORNode) => void;
  onNodeClick?: (node: CBORNode) => void;
}

function TreeNode({ node, depth, onNodeHover, onNodeClick }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels
  const hasChildren = node.children && node.children.length > 0;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'array': return 'text-blue-500';
      case 'object': return 'text-green-500';
      case 'string': return 'text-yellow-500';
      case 'number': return 'text-purple-500';
      case 'bytes': return 'text-orange-500';
      case 'tag': return 'text-pink-500';
      default: return 'text-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'array': return '[]';
      case 'object': return '{}';
      case 'string': return '"';
      case 'number': return '#';
      case 'bytes': return '0x';
      case 'tag': return '&';
      default: return '?';
    }
  };

  const formatValue = (value: unknown, type: string) => {
    if (type === 'bytes') {
      if (typeof value === 'string') {
        return `0x${value.slice(0, 16)}${value.length > 16 ? '...' : ''}`;
      }
      return `0x${String(value).slice(0, 16)}...`;
    }
    if (type === 'string') {
      return `"${String(value)}"`;
    }
    if (type === 'array') {
      return `[${Array.isArray(value) ? value.length : 0} items]`;
    }
    if (type === 'object') {
      return `{${node.children?.length || 0} pairs}`;
    }
    return String(value);
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center py-1 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors",
          depth > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onMouseEnter={() => onNodeHover?.(node)}
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          }
          onNodeClick?.(node);
        }}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button
            className="mr-2 p-0.5 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="w-4 mr-2" />
        )}

        {/* Type icon */}
        <span className={cn("mr-2 text-xs", getTypeColor(node.type))}>
          {getTypeIcon(node.type)}
        </span>

        {/* Node label */}
        <span className="flex-1 truncate">
          {node.label || `${node.type}: ${formatValue(node.value, node.type)}`}
        </span>

        {/* Byte range */}
        <span className="text-xs text-muted-foreground ml-2">
          {node.startByte}-{node.endByte - 1}
        </span>

        {/* Info tooltip */}
        {node.description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="ml-2 p-0.5 hover:bg-muted rounded">
                <Info className="h-3 w-3 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{node.description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onNodeHover={onNodeHover}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
