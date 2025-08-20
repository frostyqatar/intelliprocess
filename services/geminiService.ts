
import { GoogleGenAI, Type } from "@google/genai";
import { Node, Edge, ShapeType } from "../types";
import { SHAPE_DIMENSIONS } from "../constants";

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        nodes: {
            type: Type.ARRAY,
            description: "Array of process nodes. Existing nodes will be replaced.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A unique identifier for the node, e.g., 'node-1'" },
                    type: { type: Type.STRING, description: "The shape type. Must be one of: 'Process', 'Decision', 'Start', 'End', 'Email'" },
                    label: { type: Type.STRING, description: "The text label displayed on the node." },
                    position: {
                        type: Type.OBJECT,
                        properties: {
                            x: { type: Type.NUMBER, description: "The X coordinate for the top-left corner." },
                            y: { type: Type.NUMBER, description: "The Y coordinate for the top-left corner." },
                        },
                        required: ["x", "y"]
                    },
                },
                required: ["id", "type", "label", "position"],
            },
        },
        edges: {
            type: Type.ARRAY,
            description: "Array of edges connecting the nodes. Existing edges will be replaced.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A unique identifier for the edge, e.g., 'edge-1'" },
                    source: { type: Type.STRING, description: "The id of the source node." },
                    target: { type: Type.STRING, description: "The id of the target node." },
                    label: { type: Type.STRING, description: "Optional label for the edge, e.g., 'Yes' or 'No' for decisions." },
                },
                required: ["id", "source", "target"],
            },
        },
    },
    required: ["nodes", "edges"],
};

export async function generateDiagramFromPrompt(prompt: string, apiKey: string): Promise<{ nodes: Node[]; edges: Edge[] }> {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }
    
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an expert process mapping assistant. Based on the user's prompt, generate a complete process diagram as a JSON object.
- Create clear, concise labels.
- The top-left of the canvas is (0,0). Layout is crucial. Follow a logical flow, primarily from left to right.
- A typical horizontal gap between nodes is 150-200 pixels. A typical vertical gap is 100-150 pixels.
- Use the 'Email' node type for notification steps. It can be part of the main flow.
- For branching logic, when a 'Process' node is immediately followed by a 'Decision' node, place the 'Decision' node vertically below the 'Process' node to represent a query or check. Subsequent branches from the decision should flow outwards.
- Ensure all node IDs in edges correspond to nodes you've defined.
- Always include a 'Start' node and an 'End' node for the main process flow.
- Do not use any existing nodes; create a completely new diagram based on the prompt. Your response will replace the entire current diagram.
- Ensure the output perfectly matches the provided JSON schema.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
        },
    });

    try {
        const jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText) as { nodes: Omit<Node, 'width'|'height'>[], edges: Edge[] };
        
        if (!parsedJson.nodes || !parsedJson.edges) {
            throw new Error("Invalid JSON structure from AI.");
        }
        
        const nodesWithDimensions: Node[] = parsedJson.nodes.map(node => {
            if (!Object.values(ShapeType).includes(node.type as ShapeType)) {
                 // Fallback for invalid shape type
                console.warn(`Invalid shape type '${node.type}' received from AI. Defaulting to Process.`);
                return { ...node, type: ShapeType.Process, ...SHAPE_DIMENSIONS[ShapeType.Process] };
            }
            return {
                ...node,
                ...SHAPE_DIMENSIONS[node.type as ShapeType]
            };
        });
        
        return { nodes: nodesWithDimensions, edges: parsedJson.edges };

    } catch (e) {
        console.error("Failed to parse AI response:", e);
        console.error("Raw AI response:", response.text);
        throw new Error("The AI returned an invalid response. Please try rephrasing your request.");
    }
}
