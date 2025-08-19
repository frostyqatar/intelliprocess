import { ShapeType, Project } from './types';

export const SHAPE_DIMENSIONS = {
  [ShapeType.Process]: { width: 140, height: 80 },
  [ShapeType.Decision]: { width: 140, height: 100 },
  [ShapeType.Start]: { width: 140, height: 60 },
  [ShapeType.End]: { width: 140, height: 60 },
  [ShapeType.Email]: { width: 100, height: 100 },
};

export const initialProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Technical Writing Workflow',
    nodes: [
      { id: 'n1', type: ShapeType.Start, position: { x: 50, y: 250 }, label: 'Writer gathers information', width: 140, height: 60 },
      { id: 'n2', type: ShapeType.Process, position: { x: 250, y: 240 }, label: 'Writer composes first draft', width: 140, height: 80 },
      { id: 'n3', type: ShapeType.Process, position: { x: 450, y: 240 }, label: 'Writer submits draft for review', width: 140, height: 80 },
      { id: 'n4', type: ShapeType.Process, position: { x: 650, y: 100 }, label: 'Engineering Team Lead review', width: 140, height: 80 },
      { id: 'n5', type: ShapeType.Process, position: { x: 650, y: 240 }, label: 'Editor', width: 140, height: 80 },
      { id: 'n6', type: ShapeType.Process, position: { x: 650, y: 380 }, label: 'Project Manager review', width: 140, height: 80 },
      { id: 'n7', type: ShapeType.Process, position: { x: 850, y: 240 }, label: 'Writer incorporates SME feedback', width: 140, height: 80 },
      { id: 'n8', type: ShapeType.Process, position: { x: 1050, y: 240 }, label: 'Writer submits final draft', width: 140, height: 80 },
      { id: 'n9', type: ShapeType.Decision, position: { x: 1250, y: 230 }, label: 'Content approved or rejected', width: 140, height: 100 },
      { id: 'n10', type: ShapeType.End, position: { x: 1450, y: 100 }, label: 'Writer publishes content', width: 140, height: 60 },
      { id: 'n11', type: ShapeType.Email, position: { x: 50, y: 50 }, label: 'Notify manager of new draft', width: 100, height: 100 },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 1, targetHandle: 3 },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 1, targetHandle: 3 },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 0, targetHandle: 3 },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 1, targetHandle: 3 },
      { id: 'e5', source: 'n3', target: 'n6', sourceHandle: 2, targetHandle: 3 },
      { id: 'e6', source: 'n4', target: 'n7', sourceHandle: 1, targetHandle: 0 },
      { id: 'e7', source: 'n5', target: 'n7', sourceHandle: 1, targetHandle: 3 },
      { id: 'e8', source: 'n6', target: 'n7', sourceHandle: 1, targetHandle: 2 },
      { id: 'e9', source: 'n7', target: 'n8', sourceHandle: 1, targetHandle: 3 },
      { id: 'e10', source: 'n8', target: 'n9', sourceHandle: 1, targetHandle: 3 },
      { id: 'e11', source: 'n9', target: 'n10', label: 'Approved', sourceHandle: 0, targetHandle: 3 },
      { id: 'e12', source: 'n9', target: 'n8', label: 'Rejected', sourceHandle: 2, targetHandle: 2 },
    ]
  }
];