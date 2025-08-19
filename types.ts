export enum ShapeType {
  Process = 'Process',
  Decision = 'Decision',
  Start = 'Start',
  End = 'End',
  Email = 'Email',
}

export interface Position {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  type: ShapeType;
  position: Position;
  label: string;
  width: number;
  height: number;
}

export interface Edge {
  id:string;
  source: string;
  target: string;
  sourceHandle?: number; // 0: top, 1: right, 2: bottom, 3: left
  targetHandle?: number; // 0: top, 1: right, 2: bottom, 3: left
  label?: string;
}

export interface Project {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
}