import { toPng } from 'html-to-image';
import { Project, Edge, ShapeType, Node } from '../types';

function downloadFile(content: string, fileName: string, contentType: string) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function embedStyles(svg: SVGSVGElement): Promise<SVGSVGElement> {
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    
    try {
        // Fetch Tailwind CSS from CDN
        const cssResponse = await fetch('https://cdn.tailwindcss.com');
        if (!cssResponse.ok) throw new Error('Failed to fetch stylesheet');
        const cssText = await cssResponse.text();
        
        // Create a style element and add it to the defs of the cloned SVG
        const style = document.createElement('style');
        style.textContent = cssText;
        
        let defs = clonedSvg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            clonedSvg.prepend(defs);
        }
        defs.appendChild(style);
    } catch (error) {
        console.error("Could not embed Tailwind styles for PNG export:", error);
        alert("Could not fetch styles for PNG export. The exported image may have incorrect colors.");
    }
    
    return clonedSvg;
}

export async function exportToPng(element: HTMLElement, fileName: string) {
  const svgElement = element.querySelector('svg');
  if (!svgElement) {
    console.error("Export failed: SVG element not found.");
    alert("Export failed: Could not find the canvas SVG element.");
    return;
  }
  
  try {
    const styledSvg = await embedStyles(svgElement);
    
    // Set explicit size for rendering
    styledSvg.setAttribute('width', `${element.clientWidth}`);
    styledSvg.setAttribute('height', `${element.clientHeight}`);
    
    const dataUrl = await toPng(styledSvg as unknown as HTMLElement, {
      pixelRatio: 2,
      width: element.clientWidth,
      height: element.clientHeight,
    });

    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    alert('An error occurred while exporting the PNG. Please check the console for details and try again.');
    console.error('Failed to export to PNG', err);
  }
}

export function exportToJson(data: Project | Project[], fileName: string) {
  const jsonString = JSON.stringify(data, null, 2);
  downloadFile(jsonString, fileName, 'application/json');
}

export function exportToText(project: Project, fileName: string) {
  let content = `Project: ${project.name}\n\n`;

  const emailNodes = project.nodes.filter(n => n.type === ShapeType.Email);
  const flowNodes = project.nodes.filter(n => n.type !== ShapeType.Email);

  if (emailNodes.length > 0) {
    content += "--- Notification Steps ---\n";
    emailNodes.forEach(node => {
      content += `- [${node.type}] ${node.label}\n`;
    });
    content += "\n";
  }

  content += "--- Process Flow ---\n";

  if (flowNodes.length === 0) {
    content += "No process flow nodes found.\n";
    downloadFile(content, fileName, 'text/plain');
    return;
  }
  
  const nodeMap = new Map(flowNodes.map(n => [n.id, n]));
  const outEdges = new Map<string, Edge[]>(flowNodes.map(n => [n.id, []]));
  const inDegree = new Map<string, number>(flowNodes.map(n => [n.id, 0]));

  project.edges.forEach(edge => {
    if (outEdges.has(edge.source)) {
      outEdges.get(edge.source)!.push(edge);
    }
    if (inDegree.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  });

  const visited = new Set<string>();
  let stepCounter = 1;

  function tracePath(nodeId: string, indent: string) {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    if (visited.has(nodeId)) {
      content += `${indent}--> (Loops back to: [${node.type}] ${node.label})\n`;
      return;
    }
    
    visited.add(nodeId);
    content += `${indent}${stepCounter++}. [${node.type}] ${node.label}\n`;

    const children = outEdges.get(nodeId) || [];

    if (children.length === 1) {
      const edge = children[0];
      const edgeLabel = edge.label ? `(${edge.label})` : '';
      content += `${indent}   | ${edgeLabel}\n`;
      content += `${indent}   v\n`;
      tracePath(edge.target, indent);
    } else if (children.length > 1) {
      children.forEach(edge => {
        const targetNode = nodeMap.get(edge.target);
        if (targetNode) {
          const branchIndent = indent + '   ';
          content += `${branchIndent}--> (${edge.label || 'next'}) to:\n`;
          tracePath(edge.target, branchIndent);
        }
      });
    }
  }

  const startNodes = flowNodes.filter(n => (inDegree.get(n.id) || 0) === 0);
  startNodes.forEach(node => {
    if (!visited.has(node.id)) {
      tracePath(node.id, '');
      content += '\n';
    }
  });

  const unvisitedNodes = flowNodes.filter(n => !visited.has(n.id));
  if (unvisitedNodes.length > 0) {
    content += "\n--- Other Flows or Unconnected Nodes ---\n";
    unvisitedNodes.forEach(node => {
      if (!visited.has(node.id)) {
        tracePath(node.id, '');
        content += '\n';
      }
    });
  }

  downloadFile(content, fileName, 'text/plain');
}