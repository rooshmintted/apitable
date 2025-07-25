declare module 'react-d3-tree' {
  import { Component } from 'react';

  export interface RawNodeDatum {
    name: string;
    attributes?: { [key: string]: any };
    children?: RawNodeDatum[];
  }

  export interface TreeNodeDatum extends RawNodeDatum {
    __rd3t: {
      id: string;
      depth: number;
      collapsed: boolean;
    };
  }

  export interface Point {
    x: number;
    y: number;
  }

  export interface TreeProps {
    data: RawNodeDatum | RawNodeDatum[];
    orientation?: 'horizontal' | 'vertical';
    translate?: Point;
    pathFunc?: 'diagonal' | 'elbow' | 'straight' | 'step';
    pathClassFunc?: (link: any, orientation: string) => string;
    scaleExtent?: { min: number; max: number };
    nodeSize?: { x: number; y: number };
    separation?: { siblings: number; nonSiblings: number };
    zoom?: number;
    enableLegacyTransitions?: boolean;
    renderCustomNodeElement?: (rd3tProps: {
      nodeDatum: TreeNodeDatum;
      toggleNode: () => void;
      onNodeClick: (node: TreeNodeDatum) => void;
      onNodeMouseOver: (node: TreeNodeDatum) => void;
      onNodeMouseOut: (node: TreeNodeDatum) => void;
      styles: any;
    }) => JSX.Element;
    onNodeClick?: (node: TreeNodeDatum) => void;
    onNodeMouseOver?: (node: TreeNodeDatum) => void;
    onNodeMouseOut?: (node: TreeNodeDatum) => void;
    onLinkClick?: (source: TreeNodeDatum, target: TreeNodeDatum) => void;
    onLinkMouseOver?: (source: TreeNodeDatum, target: TreeNodeDatum) => void;
    onLinkMouseOut?: (source: TreeNodeDatum, target: TreeNodeDatum) => void;
    shouldCollapseNeighborNodes?: boolean;
    svgClassName?: string;
    rootNodeClassName?: string;
    branchNodeClassName?: string;
    leafNodeClassName?: string;
    depthFactor?: number;
    collapsible?: boolean;
    initialDepth?: number;
    transitionDuration?: number;
    margins?: { top: number; bottom: number; left: number; right: number };
    centeringTransitionDuration?: number;
  }

  export default class Tree extends Component<TreeProps> {}
} 