import { Node, Edge, Position } from '../types';

export const getConnectorPos = (node: Node, handleIndex: number): Position => {
    const connectors = [
        { x: node.width / 2, y: 0 }, // Top
        { x: node.width, y: node.height / 2 }, // Right
        { x: node.width / 2, y: node.height }, // Bottom
        { x: 0, y: node.height / 2 }, // Left
    ];
    const connector = connectors[handleIndex];
    return {
        x: node.position.x + connector.x,
        y: node.position.y + connector.y
    };
};

export function getOrthogonalPath(sourceNode: Node, targetNode: Node, edge: Edge) {
    const sourceHandle = edge.sourceHandle ?? 1;
    const targetHandle = edge.targetHandle ?? 3;

    const startPos = getConnectorPos(sourceNode, sourceHandle);
    const endPos = getConnectorPos(targetNode, targetHandle);
    
    if (edge.source === edge.target) { // Loopback edge
      const pad = 20;
      const x1 = startPos.x;
      const y1 = startPos.y;
      const pathPoints = [
        {x: x1, y: y1},
        {x: x1, y: y1 - pad},
        {x: x1 + sourceNode.width/2 + pad, y: y1 - pad},
        {x: x1 + sourceNode.width/2 + pad, y: y1 + sourceNode.height/2 + pad},
        {x: x1, y: y1 + sourceNode.height/2 + pad},
        endPos
      ];
      const path = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return { path, startPos, endPos, midPoint: pathPoints[2]};
    }

    const PADDING = 25;
    const points: Position[] = [startPos];
    let p1 = { ...startPos };
    let p2 = { ...endPos };
    
    // Create stubs from source and target
    if (sourceHandle === 0) p1.y -= PADDING;
    else if (sourceHandle === 1) p1.x += PADDING;
    else if (sourceHandle === 2) p1.y += PADDING;
    else if (sourceHandle === 3) p1.x -= PADDING;

    if (targetHandle === 0) p2.y += PADDING;
    else if (targetHandle === 1) p2.x -= PADDING;
    else if (targetHandle === 2) p2.y -= PADDING;
    else if (targetHandle === 3) p2.x += PADDING;
    
    points.push(p1);

    const isSourceHorizontal = sourceHandle === 1 || sourceHandle === 3;
    
    // Add intermediate point(s) to connect the stubs
    if (isSourceHorizontal) {
        points.push({ x: p1.x, y: p2.y });
    } else {
        points.push({ x: p2.x, y: p1.y });
    }

    points.push(p2);
    points.push(endPos);
    
    // Clean up redundant points
    const finalPoints = points.reduce((acc, p) => {
        const last = acc[acc.length - 1];
        if (!last || last.x !== p.x || last.y !== p.y) {
          // Check for U-turns
          if (acc.length >= 2) {
            const prev = acc[acc.length - 2];
            if (prev.x === p.x || prev.y === p.y) {
              acc.pop();
            }
          }
          acc.push(p);
        }
        return acc;
    }, [] as Position[]);

    const path = finalPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const midPointIndex = Math.floor(finalPoints.length / 2);
    const pA = finalPoints[midPointIndex - 1] || startPos;
    const pB = finalPoints[midPointIndex] || endPos;
    const midPoint = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };

    return { path, startPos, endPos, midPoint };
}