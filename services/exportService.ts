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

async function embedStyles(svg: SVGSVGElement, forPdf: boolean = false): Promise<SVGSVGElement> {
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

        // Fix arrow markers for PDF export by ensuring they have explicit colors
        if (forPdf) {
            const markers = clonedSvg.querySelectorAll('marker');
            markers.forEach(marker => {
                const paths = marker.querySelectorAll('path');
                paths.forEach(path => {
                    if (!path.getAttribute('fill') || path.getAttribute('fill') === 'currentColor') {
                        path.setAttribute('fill', '#6366f1'); // Default arrow color
                    }
                });
            });
        }
    } catch (error) {
        console.error("Could not embed styles for PNG export:", error);
        alert("Could not embed styles for PNG export. The exported image may have incorrect colors. Please check the console for details.");
    }
    
    return clonedSvg;
}


export async function exportToPng(project: Project, svgElement: SVGSVGElement, fileName: string, backgroundColor: string = '#1f2937') {
  if (!project || project.nodes.length === 0) {
    alert("Cannot export an empty project to PNG.");
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
  
  try {
    const styledSvg = await embedStyles(svgToRender, false);
    
    const dataUrl = await toPng(styledSvg as unknown as HTMLElement, {
      pixelRatio: 2, // Use 2x resolution for high quality
      width: contentWidth,
      height: contentHeight,
      backgroundColor: backgroundColor === 'transparent' ? undefined : backgroundColor,
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

export async function exportToPdf(project: Project, svgElement: SVGSVGElement, fileName: string, backgroundColor: string = '#1f2937') {
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
  const styledSvg = await embedStyles(svgToRender, true);

  try {
    // 3. Convert the prepared SVG to a high-resolution PNG data URL in memory
    const dataUrl = await toPng(styledSvg as unknown as HTMLElement, {
      pixelRatio: 2, // Use 2x resolution for high quality
      width: contentWidth,
      height: contentHeight,
      backgroundColor: backgroundColor === 'transparent' ? '#ffffff' : backgroundColor,
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

export function exportToVisio(project: Project, fileName: string) {
  if (!project || project.nodes.length === 0) {
    alert("Cannot export an empty project to Visio.");
    return;
  }

  // Create VDX (Visio XML) format
  const vdxContent = generateVisioVdx(project);
  downloadFile(vdxContent, fileName, 'application/xml');
}

function generateVisioVdx(project: Project): string {
  const { nodes, edges } = project;
  
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node.width);
    maxY = Math.max(maxY, node.position.y + node.height);
  });

  const pageWidth = Math.max(800, maxX - minX + 100);
  const pageHeight = Math.max(600, maxY - minY + 100);

  // Map our node types to Visio shapes
  const shapeTypeMap: Record<string, string> = {
    'Process': 'Rectangle',
    'Decision': 'Diamond',
    'Start': 'Ellipse', 
    'End': 'Ellipse',
    'Email': 'Rectangle'
  };

  const shapeElements = nodes.map((node, index) => {
    const shapeType = shapeTypeMap[node.type] || 'Rectangle';
    const x = node.position.x - minX + 50;
    const y = node.position.y - minY + 50;
    
    return `
      <Shape ID="${index + 1}" Type="Shape" LineStyle="3" FillStyle="3" TextStyle="3">
        <XForm>
          <PinX>${x + node.width/2}</PinX>
          <PinY>${pageHeight - (y + node.height/2)}</PinY>
          <Width>${node.width}</Width>
          <Height>${node.height}</Height>
        </XForm>
        <Text>
          <cp IX="0"/>
          <pp IX="0" HorzAlign="1" VertAlign="2"/>
          <tp>${escapeXml(node.label)}</tp>
        </Text>
        <Shapes>
          <Shape ID="${index + 1}" Master="1" MasterShape="1">
            <XForm>
              <PinX>${x + node.width/2}</PinX>
              <PinY>${pageHeight - (y + node.height/2)}</PinY>
              <Width>${node.width}</Width>
              <Height>${node.height}</Height>
            </XForm>
            <Text>
              <cp IX="0"/>
              <pp IX="0" HorzAlign="1" VertAlign="2"/>
              <tp>${escapeXml(node.label)}</tp>
            </Text>
          </Shape>
        </Shapes>
      </Shape>`;
  }).join('');

  const connectorElements = edges.map((edge, index) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return '';
    
    const sourceX = sourceNode.position.x - minX + 50 + sourceNode.width/2;
    const sourceY = pageHeight - (sourceNode.position.y - minY + 50 + sourceNode.height/2);
    const targetX = targetNode.position.x - minX + 50 + targetNode.width/2;
    const targetY = pageHeight - (targetNode.position.y - minY + 50 + targetNode.height/2);
    
    return `
      <Shape ID="${nodes.length + index + 1}" Type="Shape" LineStyle="3" FillStyle="3" TextStyle="3">
        <XForm>
          <PinX>${(sourceX + targetX) / 2}</PinX>
          <PinY>${(sourceY + targetY) / 2}</PinY>
          <Width>0</Width>
          <Height>0</Height>
        </XForm>
        <Text>
          <cp IX="0"/>
          <pp IX="0" HorzAlign="1" VertAlign="2"/>
          <tp>${edge.label ? escapeXml(edge.label) : ''}</tp>
        </Text>
        <Shapes>
          <Shape ID="${nodes.length + index + 1}" Master="2" MasterShape="2">
            <XForm>
              <PinX>${(sourceX + targetX) / 2}</PinX>
              <PinY>${(sourceY + targetY) / 2}</PinY>
              <Width>0</Width>
              <Height>0</Height>
            </XForm>
            <Text>
              <cp IX="0"/>
              <pp IX="0" HorzAlign="1" VertAlign="2"/>
              <tp>${edge.label ? escapeXml(edge.label) : ''}</tp>
            </Text>
          </Shape>
        </Shapes>
      </Shape>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<VisioDocument xmlns="http://schemas.microsoft.com/visio/2003/core" xml:space="preserve">
  <DocumentProperties>
    <Title>${escapeXml(project.name)}</Title>
    <Creator>IntelliProcess</Creator>
    <Company></Company>
    <Category></Category>
    <Manager></Manager>
    <Subject></Subject>
    <Description>Exported from IntelliProcess</Description>
    <Keywords></Keywords>
    <Language>1033</Language>
    <PreviewPicture>
      <cp IX="0"/>
    </PreviewPicture>
    <CustomProps>
      <CustomProp Name="msvStructureType" Type="4" Value="0"/>
      <CustomProp Name="msvSD" Type="4" Value="0"/>
    </CustomProps>
    <Build>0</Build>
    <GlueSettings>9</GlueSettings>
    <SnapSettings>65847</SnapSettings>
    <SnapExtensions>34</SnapExtensions>
    <SnapAngles>
      <SnapAngle IX="0" Angle="0"/>
    </SnapAngles>
    <DynamicGridEnabled>0</DynamicGridEnabled>
    <ProtectStyles>0</ProtectStyles>
    <ProtectShapes>0</ProtectShapes>
    <ProtectMasters>0</ProtectMasters>
    <ProtectBkgnds>0</ProtectBkgnds>
  </DocumentProperties>
  <DocumentSettings>
    <GlueSettings>9</GlueSettings>
    <SnapSettings>65847</SnapSettings>
    <SnapExtensions>34</SnapExtensions>
    <SnapAngles>
      <SnapAngle IX="0" Angle="0"/>
    </SnapAngles>
    <DynamicGridEnabled>0</DynamicGridEnabled>
    <ProtectStyles>0</ProtectStyles>
    <ProtectShapes>0</ProtectShapes>
    <ProtectMasters>0</ProtectMasters>
    <ProtectBkgnds>0</ProtectBkgnds>
  </DocumentSettings>
  <Colors>
    <ColorEntry IX="0" RGB="#000000"/>
    <ColorEntry IX="1" RGB="#FFFFFF"/>
    <ColorEntry IX="2" RGB="#FF0000"/>
    <ColorEntry IX="3" RGB="#00FF00"/>
    <ColorEntry IX="4" RGB="#0000FF"/>
    <ColorEntry IX="5" RGB="#FFFF00"/>
    <ColorEntry IX="6" RGB="#FF00FF"/>
    <ColorEntry IX="7" RGB="#00FFFF"/>
    <ColorEntry IX="8" RGB="#800000"/>
    <ColorEntry IX="9" RGB="#008000"/>
    <ColorEntry IX="10" RGB="#000080"/>
    <ColorEntry IX="11" RGB="#808000"/>
    <ColorEntry IX="12" RGB="#800080"/>
    <ColorEntry IX="13" RGB="#008080"/>
    <ColorEntry IX="14" RGB="#C0C0C0"/>
    <ColorEntry IX="15" RGB="#808080"/>
  </Colors>
  <FaceNames>
    <FaceName ID="0" Name="Arial" UnicodeRanges="-536870912 67108863" CodePages="1252 1250 1251 1253 1254 1255 1256 1257 1258 869 866 865 864 863 862 861 860 857 855 852 775 737 708 850 437" Panos="2 11 6 4 2 2 2 9 2 4" FontFlags="32833"/>
    <FaceName ID="1" Name="Arial" UnicodeRanges="-536870912 67108863" CodePages="1252 1250 1251 1253 1254 1255 1256 1257 1258 869 866 865 864 863 862 861 860 857 855 852 775 737 708 850 437" Panos="2 11 6 4 2 2 2 9 2 4" FontFlags="32833"/>
  </FaceNames>
  <StyleSheets>
    <StyleSheet ID="0" NameU="No Style" Name="No Style" LineStyle="0" FillStyle="0" TextStyle="0">
      <Line>
        <LineWeight>0.01</LineWeight>
        <LineColor>0</LineColor>
        <LinePattern>1</LinePattern>
        <BeginArrow>0</BeginArrow>
        <EndArrow>0</EndArrow>
        <LineCap>0</LineCap>
        <BeginArrowSize>2</BeginArrowSize>
        <EndArrowSize>2</EndArrowSize>
        <LineColorTrans>0</LineColorTrans>
      </Line>
      <Fill>
        <FillForegnd>0</FillForegnd>
        <FillBkgnd>1</FillBkgnd>
        <FillPattern>0</FillPattern>
        <ShdwForegnd>0</ShdwForegnd>
        <ShdwBkgnd>1</ShdwBkgnd>
        <ShdwPattern>0</ShdwPattern>
        <FillForegndTrans>0</FillForegndTrans>
        <FillBkgndTrans>0</FillBkgndTrans>
        <ShdwForegndTrans>0</ShdwForegndTrans>
        <ShdwBkgndTrans>0</ShdwBkgndTrans>
      </Fill>
      <TextBlock>
        <LeftMargin>0.05555555555555555</LeftMargin>
        <RightMargin>0.05555555555555555</RightMargin>
        <TopMargin>0.05555555555555555</TopMargin>
        <BottomMargin>0.05555555555555555</BottomMargin>
        <VerticalAlign>1</VerticalAlign>
        <TextBkgnd>0</TextBkgnd>
        <DefaultTabStop>0.5</DefaultTabStop>
        <TextDirection>0</TextDirection>
      </TextBlock>
      <Protection>
        <LockWidth>0</LockWidth>
        <LockHeight>0</LockHeight>
        <LockMoveX>0</LockMoveX>
        <LockMoveY>0</LockMoveY>
        <LockAspect>0</LockAspect>
        <LockDelete>0</LockDelete>
        <LockBegin>0</LockBegin>
        <LockEnd>0</LockEnd>
        <LockRotate>0</LockRotate>
        <LockCrop>0</LockCrop>
        <LockVtxEdit>0</LockVtxEdit>
        <LockTextEdit>0</LockTextEdit>
        <LockFormat>0</LockFormat>
        <LockGroup>0</LockGroup>
        <LockCalcWH>0</LockCalcWH>
        <LockSelect>0</LockSelect>
        <LockCustProp>0</LockCustProp>
      </Protection>
      <Misc>
        <NoObjHandles>0</NoObjHandles>
        <NonPrinting>0</NonPrinting>
        <NoCtlHandles>0</NoCtlHandles>
        <NoAlignBox>0</NoAlignBox>
        <UpdateAlignBox>0</UpdateAlignBox>
        <HideText>0</HideText>
        <DynFeedback>0</DynFeedback>
        <GlueType>0</GlueType>
        <WalkPreference>0</WalkPreference>
        <BegTrigger F="No Formula" V="0"/>
        <EndTrigger F="No Formula" V="0"/>
        <ObjType>0</ObjType>
        <Comment></Comment>
        <IsDropSource>0</IsDropSource>
        <NoLiveDynamics>0</NoLiveDynamics>
        <LocalizeMerge>0</LocalizeMerge>
        <Calendar>0</Calendar>
        <LangID>1033</LangID>
        <ShapeKeywords></ShapeKeywords>
        <DropOnPageScale>0</DropOnPageScale>
        <ShapeFixedCode>0</ShapeFixedCode>
        <ShapePermeableX>0</ShapePermeableX>
        <ShapePermeableY>0</ShapePermeableY>
        <ShapePermeablePlace>0</ShapePermeablePlace>
        <ShapePlaceFlip>0</ShapePlaceFlip>
        <ShapePlaceStyle>0</ShapePlaceStyle>
        <ShapeSplit>0</ShapeSplit>
        <ShapeSplittable>0</ShapeSplittable>
        <DisplayMode>0</DisplayMode>
        <InhibitSnap>0</InhibitSnap>
        <HideForApply>0</HideForApply>
        <ThemeIndex>1000</ThemeIndex>
        <QuickStyleLineColor>0</QuickStyleLineColor>
        <QuickStyleFillColor>0</QuickStyleFillColor>
        <QuickStyleShadowColor>0</QuickStyleShadowColor>
        <QuickStyleFontColor>0</QuickStyleFontColor>
        <QuickStyleLineMatrix>0</QuickStyleLineMatrix>
        <QuickStyleFillMatrix>0</QuickStyleFillMatrix>
        <QuickStyleEffectsMatrix>0</QuickStyleEffectsMatrix>
        <QuickStyleFontMatrix>0</QuickStyleFontMatrix>
        <QuickStyleType>0</QuickStyleType>
        <QuickStyleVariation>0</QuickStyleVariation>
      </Misc>
      <Layout>
        <ShapePlaceStyle>0</ShapePlaceStyle>
        <ShapeRouteStyle>0</ShapePlaceStyle>
        <ShapePlaceFlip>0</ShapePlaceFlip>
        <ShapeSplit>0</ShapeSplit>
        <ShapeSplittable>0</ShapeSplittable>
        <ShapeDisplayPage>0</ShapeDisplayPage>
      </Layout>
      <ActionTags>
        <ActionTag ID="0" Name="Action" Menu="Action" Action="0" ButtonFace="0" SortKey="0" Disabled="0" Checked="0" ReadOnly="0" Invisible="0" BeginGroup="0" FlyoutChild="0" QueryContinue="0" QueryCancel="0" QueryCancelDocument="0" QuerySuspend="0" QuerySuspendEvents="0" QueryUISuspend="0" QueryReplaceShape="0" QueryPageDelete="0" QuerySelectionDelete="0" QueryUndelete="0" QueryCommitSelToGroup="0" QueryBreakGroup="0" QueryDropOnText="0" QueryDropOnSubProcess="0" QueryDropOnCallout="0" QueryDropOnPage="0" QueryDropOnMaster="0" QueryDropOnOleObject="0" QueryDropOnOle2Object="0" QueryDropOnQuickShape="0" QueryDropOnContainerShape="0" QueryDropOnListShape="0" QueryDropOnCalloutTarget="0" QueryDropOnTextTarget="0" QueryDropOnContainerShapeTarget="0" QueryDropOnListShapeTarget="0" QueryDropOnOleObjectTarget="0" QueryDropOnOle2ObjectTarget="0" QueryDropOnQuickShapeTarget="0" QueryDropOnSubProcessTarget="0" QueryDropOnCalloutTarget2="0" QueryDropOnTextTarget2="0" QueryDropOnContainerShapeTarget2="0" QueryDropOnListShapeTarget2="0" QueryDropOnOleObjectTarget2="0" QueryDropOnOle2ObjectTarget2="0" QueryDropOnQuickShapeTarget2="0" QueryDropOnSubProcessTarget2="0" QueryDropOnCalloutTarget3="0" QueryDropOnTextTarget3="0" QueryDropOnContainerShapeTarget3="0" QueryDropOnListShapeTarget3="0" QueryDropOnOleObjectTarget3="0" QueryDropOnOle2ObjectTarget3="0" QueryDropOnQuickShapeTarget3="0" QueryDropOnSubProcessTarget3="0" QueryDropOnCalloutTarget4="0" QueryDropOnTextTarget4="0" QueryDropOnContainerShapeTarget4="0" QueryDropOnListShapeTarget4="0" QueryDropOnOleObjectTarget4="0" QueryDropOnOle2ObjectTarget4="0" QueryDropOnQuickShapeTarget4="0" QueryDropOnSubProcessTarget4="0"/>
      </ActionTags>
    </StyleSheet>
  </StyleSheets>
  <DocumentSheet NameU="TheDoc" Name="TheDoc" UniqueID="{00000000-0000-0000-0000-000000000000}">
    <Properties>
      <Property ID="0" Name="OutputFormat" Type="2" Value="VDX"/>
      <Property ID="1" Name="LockPreview" Type="2" Value="0"/>
      <Property ID="2" Name="PreviewQuality" Type="2" Value="0"/>
      <Property ID="3" Name="PreviewScope" Type="2" Value="0"/>
      <Property ID="4" Name="GlueSettings" Type="3" Value="9"/>
      <Property ID="5" Name="SnapSettings" Type="3" Value="65847"/>
      <Property ID="6" Name="SnapExtensions" Type="3" Value="34"/>
      <Property ID="7" Name="SnapAngles" Type="3" Value="0"/>
      <Property ID="8" Name="DynamicGridEnabled" Type="2" Value="0"/>
      <Property ID="9" Name="ProtectStyles" Type="2" Value="0"/>
      <Property ID="10" Name="ProtectShapes" Type="2" Value="0"/>
      <Property ID="11" Name="ProtectMasters" Type="2" Value="0"/>
      <Property ID="12" Name="ProtectBkgnds" Type="2" Value="0"/>
    </Properties>
  </DocumentSheet>
  <Masters>
    <Master ID="1" NameU="Rectangle" Name="Rectangle" UniqueID="{00000000-0000-0000-0000-000000000001}">
      <PageSheet NameU="ThePage" Name="ThePage" UniqueID="{00000000-0000-0000-0000-000000000002}">
        <Properties>
          <Property ID="0" Name="PageWidth" Type="3" Value="${pageWidth}"/>
          <Property ID="1" Name="PageHeight" Type="3" Value="${pageHeight}"/>
          <Property ID="2" Name="PageScale" Type="3" Value="1"/>
          <Property ID="3" Name="DrawingScaleType" Type="2" Value="0"/>
          <Property ID="4" Name="DrawingScaleUnits" Type="2" Value="0"/>
          <Property ID="5" Name="DrawingSizeType" Type="2" Value="0"/>
          <Property ID="6" Name="InhibitSnap" Type="2" Value="0"/>
          <Property ID="7" Name="UIVisibility" Type="2" Value="0"/>
          <Property ID="8" Name="ShdwOffsetX" Type="3" Value="0.125"/>
          <Property ID="9" Name="ShdwOffsetY" Type="3" Value="-0.125"/>
          <Property ID="10" Name="PageScale" Type="3" Value="1"/>
          <Property ID="11" Name="DrawingScaleType" Type="2" Value="0"/>
          <Property ID="12" Name="DrawingSizeType" Type="2" Value="0"/>
          <Property ID="13" Name="InhibitSnap" Type="2" Value="0"/>
          <Property ID="14" Name="UIVisibility" Type="2" Value="0"/>
          <Property ID="15" Name="ShdwOffsetX" Type="3" Value="0.125"/>
          <Property ID="16" Name="ShdwOffsetY" Type="3" Value="-0.125"/>
        </Properties>
      </PageSheet>
      <Shapes>
        <Shape ID="1" Type="Shape" LineStyle="3" FillStyle="3" TextStyle="3">
          <XForm>
            <PinX>0</PinX>
            <PinY>0</PinY>
            <Width>1</Width>
            <Height>1</Height>
          </XForm>
          <Text>
            <cp IX="0"/>
            <pp IX="0" HorzAlign="1" VertAlign="2"/>
            <tp></tp>
          </Text>
        </Shape>
      </Shapes>
    </Master>
    <Master ID="2" NameU="Connector" Name="Connector" UniqueID="{00000000-0000-0000-0000-000000000003}">
      <PageSheet NameU="ThePage" Name="ThePage" UniqueID="{00000000-0000-0000-0000-000000000004}">
        <Properties>
          <Property ID="0" Name="PageWidth" Type="3" Value="1"/>
          <Property ID="1" Name="PageHeight" Type="3" Value="1"/>
          <Property ID="2" Name="PageScale" Type="3" Value="1"/>
          <Property ID="3" Name="DrawingScaleType" Type="2" Value="0"/>
          <Property ID="4" Name="DrawingScaleUnits" Type="2" Value="0"/>
          <Property ID="5" Name="DrawingSizeType" Type="2" Value="0"/>
          <Property ID="6" Name="InhibitSnap" Type="2" Value="0"/>
          <Property ID="7" Name="UIVisibility" Type="2" Value="0"/>
          <Property ID="8" Name="ShdwOffsetX" Type="3" Value="0.125"/>
          <Property ID="9" Name="ShdwOffsetY" Type="3" Value="-0.125"/>
          <Property ID="10" Name="PageScale" Type="3" Value="1"/>
          <Property ID="11" Name="DrawingScaleType" Type="2" Value="0"/>
          <Property ID="12" Name="DrawingSizeType" Type="2" Value="0"/>
          <Property ID="13" Name="InhibitSnap" Type="2" Value="0"/>
          <Property ID="14" Name="UIVisibility" Type="2" Value="0"/>
          <Property ID="15" Name="ShdwOffsetX" Type="3" Value="0.125"/>
          <Property ID="16" Name="ShdwOffsetY" Type="3" Value="-0.125"/>
        </Properties>
      </PageSheet>
      <Shapes>
        <Shape ID="1" Type="Shape" LineStyle="3" FillStyle="3" TextStyle="3">
          <XForm>
            <PinX>0</PinX>
            <PinY>0</PinY>
            <Width>0</Width>
            <Height>0</Height>
          </XForm>
          <Text>
            <cp IX="0"/>
            <pp IX="0" HorzAlign="1" VertAlign="2"/>
            <tp></tp>
          </Text>
        </Shape>
      </Shapes>
    </Master>
  </Masters>
  <Pages>
    <Page ID="0" NameU="Page-1" Name="Page-1" ViewScale="-1" ViewCenterX="-1" ViewCenterY="-1" ViewPage="0" ViewFit="0" ViewType="0" ViewMarkup="0">
      <PageSheet NameU="ThePage" Name="ThePage" UniqueID="{00000000-0000-0000-0000-000000000005}">
        <Properties>
          <Property ID="0" Name="PageWidth" Type="3" Value="${pageWidth}"/>
          <Property ID="1" Name="PageHeight" Type="3" Value="${pageHeight}"/>
          <Property ID="2" Name="PageScale" Type="3" Value="1"/>
          <Property ID="3" Name="DrawingScaleType" Type="2" Value="0"/>
          <Property ID="4" Name="DrawingScaleUnits" Type="2" Value="0"/>
          <Property ID="5" Name="DrawingSizeType" Type="2" Value="0"/>
          <Property ID="6" Name="InhibitSnap" Type="2" Value="0"/>
          <Property ID="7" Name="UIVisibility" Type="2" Value="0"/>
          <Property ID="8" Name="ShdwOffsetX" Type="3" Value="0.125"/>
          <Property ID="9" Name="ShdwOffsetY" Type="3" Value="-0.125"/>
          <Property ID="10" Name="PageScale" Type="3" Value="1"/>
          <Property ID="11" Name="DrawingScaleType" Type="2" Value="0"/>
          <Property ID="12" Name="DrawingSizeType" Type="2" Value="0"/>
          <Property ID="13" Name="InhibitSnap" Type="2" Value="0"/>
          <Property ID="14" Name="UIVisibility" Type="2" Value="0"/>
          <Property ID="15" Name="ShdwOffsetY" Type="3" Value="-0.125"/>
        </Properties>
      </PageSheet>
      <Shapes>
        ${shapeElements}
        ${connectorElements}
      </Shapes>
    </Page>
  </Pages>
</VisioDocument>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}