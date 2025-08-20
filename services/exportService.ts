import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
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
        let cssText = '';
        const styleSheets = Array.from(document.styleSheets);
        
        for (const sheet of styleSheets) {
            try {
                if (sheet.cssRules) {
                    cssText += Array.from(sheet.cssRules)
                        .map(rule => rule.cssText)
                        .join('\n');
                }
            } catch (e) {
                console.warn("Could not access stylesheet rules for PNG export:", e);
            }
        }
        
        if (cssText.trim() === '') {
             throw new Error("No CSS rules found in document stylesheets to embed for export.");
        }

        const style = document.createElement('style');
        style.textContent = cssText;
        
        let defs = clonedSvg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            clonedSvg.prepend(defs);
        }
        defs.appendChild(style);
    } catch (error) {
        console.error("Could not embed styles for PNG export:", error);
        alert("Could not embed styles for PNG export. The exported image may have incorrect colors. Please check the console for details.");
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
  content += "--- Process Flow ---\n";

  if (project.nodes.length === 0) {
    content += "No process flow nodes found.\n";
    downloadFile(content, fileName, 'text/plain');
    return;
  }
  
  const nodeMap = new Map(project.nodes.map(n => [n.id, n]));
  const outEdges = new Map<string, Edge[]>(project.nodes.map(n => [n.id, []]));
  const inDegree = new Map<string, number>(project.nodes.map(n => [n.id, 0]));

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

  const startNodes = project.nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
  startNodes.forEach(node => {
    if (!visited.has(node.id)) {
      tracePath(node.id, '');
      content += '\n';
    }
  });

  const unvisitedNodes = project.nodes.filter(n => !visited.has(n.id));
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

export async function exportToPdf(project: Project, svgElement: SVGSVGElement, fileName: string) {
  if (!project || project.nodes.length === 0) {
    alert("Cannot export an empty project to PDF.");
    return;
  }

  // 1. Calculate bounding box of the entire diagram to determine dimensions
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  project.nodes.forEach(node => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node.width);
    maxY = Math.max(maxY, node.position.y + node.height);
  });

  const padding = 50;
  const diagramWidth = maxX - minX;
  const diagramHeight = maxY - minY;
  const contentWidth = diagramWidth + padding * 2;
  const contentHeight = diagramHeight + padding * 2;

  // 2. Clone the SVG and prepare it for rendering without affecting the live canvas
  const svgToRender = svgElement.cloneNode(true) as SVGSVGElement;
  const g = svgToRender.querySelector('g');

  if (g) {
    // Adjust the transform to frame the entire diagram within the new viewport
    g.setAttribute('transform', `translate(${-minX + padding}, ${-minY + padding}) scale(1)`);
  }
  
  // Set explicit dimensions on the SVG for the rendering engine
  svgToRender.setAttribute('width', `${contentWidth}`);
  svgToRender.setAttribute('height', `${contentHeight}`);
  
  // Embed all necessary CSS styles into the SVG clone for correct appearance
  const styledSvg = await embedStyles(svgToRender);

  try {
    // 3. Convert the prepared SVG to a high-resolution PNG data URL in memory
    const dataUrl = await toPng(styledSvg as unknown as HTMLElement, {
      pixelRatio: 2, // Use 2x resolution for high quality
      width: contentWidth,
      height: contentHeight,
      backgroundColor: '#1f2937', // Match canvas background color (bg-gray-800)
    });

    // 4. Create a PDF with dimensions and orientation matching the diagram
    const orientation = contentWidth > contentHeight ? 'l' : 'p';
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [contentWidth, contentHeight]
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, contentWidth, contentHeight);
    pdf.save(fileName);

  } catch (err) {
    alert('An error occurred while exporting the PDF. Please check the console for details.');
    console.error('Failed to export to PDF', err);
  }
}