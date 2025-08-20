import { Node, Edge, ShapeType } from '../types';

const Y_GAP = 120;
const X_GAP = 200;

type AdjacencyList = Map<string, string[]>;
type ReverseAdjList = Map<string, string[]>;
type NodeMap = Map<string, Node>;

export function autoLayout(nodes: Node[], edges: Edge[], orientation: 'horizontal' | 'vertical' = 'horizontal'): { newNodes: Node[], newEdges: Edge[] } {
  if (nodes.length === 0) return { newNodes: [], newEdges: [] };

  const nodeMap: NodeMap = new Map(nodes.map(n => [n.id, n]));
  const adj: AdjacencyList = new Map(nodes.map(n => [n.id, []]));
  const revAdj: ReverseAdjList = new Map(nodes.map(n => [n.id, []]));
  const inDegree = new Map(nodes.map(n => [n.id, 0]));

  const backEdges = findAndHandleCycles(nodes, edges, adj, revAdj, inDegree);

  const layers: string[][] = assignLayers(nodes, adj, inDegree);
  
  if(layers.length === 0 && nodes.length > 0) { // Handle case with only cycles
      const positionedNodes = nodes.map((node, i) => ({...node, position: {x: 50, y: 50 + i * 150}}));
      return { newNodes: positionedNodes, newEdges: edges };
  }
  
  const { dummyNodes, virtualEdges } = createVirtualGraph(layers, adj, nodeMap);
  const virtualNodeMap = new Map([...nodeMap, ...dummyNodes]);
  
  const orderedLayers = reduceCrossings(layers, virtualEdges);

  let positionedNodes = assignCoordinates(orderedLayers, virtualNodeMap, orientation);
  const finalNodeMap = new Map(positionedNodes.map(n => [n.id, n]));
  
  positionedNodes = positionedNodes.filter(n => !n.id.startsWith('dummy-'));
  
  const newEdges = assignEdgeHandles(edges, finalNodeMap, backEdges, orientation);

  return { newNodes: positionedNodes, newEdges };
}

function findAndHandleCycles(nodes: Node[], edges: Edge[], adj: AdjacencyList, revAdj: ReverseAdjList, inDegree: Map<string, number>): Set<string> {
    for (const edge of edges) {
        adj.get(edge.source)!.push(edge.target);
        revAdj.get(edge.target)!.push(edge.source);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const backEdges = new Set<string>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function dfs(nodeId: string) {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        for (const neighbor of (adj.get(nodeId) || [])) {
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            } else if (recursionStack.has(neighbor)) {
                const edgeId = `${nodeId}->${neighbor}`;
                backEdges.add(edgeId);
            }
        }
        recursionStack.delete(nodeId);
    }
    
    for (const node of nodes) {
        if (!visited.has(node.id)) {
            dfs(node.id);
        }
    }
    
    // Adjust adj and inDegree for acyclic layering
    backEdges.forEach(edgeId => {
        const [source, target] = edgeId.split('->');
        const adjList = adj.get(source);
        if (adjList) {
            const index = adjList.indexOf(target);
            if (index > -1) adjList.splice(index, 1);
        }
        inDegree.set(target, (inDegree.get(target) || 1) - 1);
    });

    return backEdges;
}

function assignLayers(nodes: Node[], adj: AdjacencyList, inDegree: Map<string, number>): string[][] {
    const layers: string[][] = [];
    let queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
    while(queue.length > 0) {
        layers.push(queue);
        const nextQueue: string[] = [];
        for (const u of queue) {
            for (const v of (adj.get(u) || [])) {
                inDegree.set(v, (inDegree.get(v) || 1) - 1);
                if (inDegree.get(v) === 0) {
                    nextQueue.push(v);
                }
            }
        }
        queue = nextQueue;
    }
    return layers;
}

function createVirtualGraph(layers: string[][], adj: AdjacencyList, nodeMap: NodeMap) {
    const dummyNodes: [string, Node][] = [];
    const virtualEdges: Edge[] = [];
    const layerMap = new Map<string, number>();
    layers.forEach((layer, i) => layer.forEach(id => layerMap.set(id, i)));
    
    for (const layer of layers) {
        for (const u of layer) {
            for (const v of (adj.get(u) || [])) {
                const uLayer = layerMap.get(u)!;
                const vLayer = layerMap.get(v)!;
                if (vLayer - uLayer > 1) {
                    let prev = u;
                    for (let i = uLayer + 1; i < vLayer; i++) {
                        const dummyId = `dummy-${u}-${v}-${i}`;
                        const dummyNode: Node = { id: dummyId, type: ShapeType.Process, position: {x:0,y:0}, label: '', width: 1, height: 50 };
                        dummyNodes.push([dummyId, dummyNode]);
                        layers[i].push(dummyId);
                        virtualEdges.push({id: `e-${prev}-${dummyId}`, source: prev, target: dummyId});
                        prev = dummyId;
                    }
                    virtualEdges.push({id: `e-${prev}-${v}`, source: prev, target: v});
                } else {
                    virtualEdges.push({id: `e-${u}-${v}`, source: u, target: v});
                }
            }
        }
    }
    return { dummyNodes, virtualEdges };
}

function reduceCrossings(layers: string[][], edges: Edge[]): string[][] {
    const adj = new Map<string, string[]>();
    const revAdj = new Map<string, string[]>();
    for (const edge of edges) {
        if (!adj.has(edge.source)) adj.set(edge.source, []);
        if (!revAdj.has(edge.target)) revAdj.set(edge.target, []);
        adj.get(edge.source)!.push(edge.target);
        revAdj.get(edge.target)!.push(edge.source);
    }

    // Barycenter method
    for (let iter = 0; iter < 4; iter++) { // 2 up and 2 down passes
        // Down pass
        for (let i = 1; i < layers.length; i++) {
            const prevLayerPos = new Map(layers[i-1].map((id, pos) => [id, pos]));
            layers[i].sort((a, b) => {
                const aNeighbors = revAdj.get(a) || [];
                const bNeighbors = revAdj.get(b) || [];
                const aMedian = median(aNeighbors.map(n => prevLayerPos.get(n)!));
                const bMedian = median(bNeighbors.map(n => prevLayerPos.get(n)!));
                return aMedian - bMedian;
            });
        }
        // Up pass
        for (let i = layers.length - 2; i >= 0; i--) {
            const nextLayerPos = new Map(layers[i+1].map((id, pos) => [id, pos]));
            layers[i].sort((a, b) => {
                const aNeighbors = adj.get(a) || [];
                const bNeighbors = adj.get(b) || [];
                const aMedian = median(aNeighbors.map(n => nextLayerPos.get(n)!));
                const bMedian = median(bNeighbors.map(n => nextLayerPos.get(n)!));
                return aMedian - bMedian;
            });
        }
    }
    return layers;
}

function assignCoordinates(layers: string[][], nodeMap: NodeMap, orientation: 'horizontal' | 'vertical'): Node[] {
    const newNodes: Node[] = [];

    if (orientation === 'horizontal') {
        const layerHeights = layers.map(layer =>
            layer.reduce((sum, id) => sum + (nodeMap.get(id)!.height), 0) + (layer.length - 1) * Y_GAP
        );
        const maxLayerHeight = Math.max(...layerHeights);
        let currentX = 50;
        
        layers.forEach(layer => {
            const layerHeight = layerHeights[layers.indexOf(layer)];
            let currentY = (maxLayerHeight - layerHeight) / 2 + 50;
            let maxW = 0;
            for (const nodeId of layer) {
                const node = nodeMap.get(nodeId)!;
                newNodes.push({ ...node, position: { x: currentX, y: currentY } });
                currentY += node.height + Y_GAP;
                if (node.width > maxW) maxW = node.width;
            }
            currentX += maxW + X_GAP;
        });
    } else { // vertical
        const layerWidths = layers.map(layer =>
            layer.reduce((sum, id) => sum + (nodeMap.get(id)!.width), 0) + (layer.length - 1) * X_GAP
        );
        const maxLayerWidth = Math.max(...layerWidths);
        let currentY = 50;

        layers.forEach(layer => {
            const layerWidth = layerWidths[layers.indexOf(layer)];
            let currentX = (maxLayerWidth - layerWidth) / 2 + 50;
            let maxH = 0;
            for (const nodeId of layer) {
                const node = nodeMap.get(nodeId)!;
                newNodes.push({ ...node, position: { x: currentX, y: currentY } });
                currentX += node.width + X_GAP;
                if (node.height > maxH) maxH = node.height;
            }
            currentY += maxH + Y_GAP;
        });
    }
    return newNodes;
}

function assignEdgeHandles(edges: Edge[], nodeMap: NodeMap, backEdges: Set<string>, orientation: 'horizontal' | 'vertical'): Edge[] {
    return edges.map(edge => {
        const source = nodeMap.get(edge.source)!;
        const target = nodeMap.get(edge.target)!;
        const isBackEdge = backEdges.has(`${edge.source}->${edge.target}`);

        if (!source || !target) return edge; // Should not happen in practice

        if (isBackEdge) {
            return { ...edge, sourceHandle: (orientation === 'horizontal' ? 2 : 1), targetHandle: (orientation === 'horizontal' ? 2 : 1) };
        }

        if (orientation === 'horizontal') {
            let sourceHandle = 1; // Right
            let targetHandle = 3; // Left
            if (source.position.y > target.position.y + 10) {
                sourceHandle = 0; // Top
                targetHandle = 2; // Bottom
            } else if (source.position.y < target.position.y - 10) {
                sourceHandle = 2; // Bottom
                targetHandle = 0; // Top
            }
            return { ...edge, sourceHandle, targetHandle };
        } else { // vertical
            let sourceHandle = 2; // Bottom
            let targetHandle = 0; // Top
            if (source.position.x > target.position.x + 10) {
                sourceHandle = 3; // Left
                targetHandle = 1; // Right
            } else if (source.position.x < target.position.x - 10) {
                sourceHandle = 1; // Right
                targetHandle = 3; // Left
            }
            return { ...edge, sourceHandle, targetHandle };
        }
    });
}

// --- Helpers ---
function median(arr: number[]): number {
    if (arr.length === 0) return -1;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
