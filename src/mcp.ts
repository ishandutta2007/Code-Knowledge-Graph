import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Database } from "sqlite";
import { setupDatabase } from "./db.js";
import * as path from "path";

export async function startMcpServer(dbPath: string) {
  const db = await setupDatabase(dbPath);

  const server = new Server(
    {
      name: "code-knowledge-graph",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search_nodes",
          description: "Search for code symbols (functions, classes, methods) by name",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Name or partial name of the symbol" },
              type: { type: "string", description: "Type of symbol (function, class, method, file)" },
            },
            required: ["query"],
          },
        },
        {
          name: "get_node_details",
          description: "Get detailed information about a node, including its content and children",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "number", description: "ID of the node" },
            },
            required: ["id"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "search_nodes") {
      const query = (args as any).query;
      const type = (args as any).type;
      
      let sql = "SELECT id, name, type, path, startLine, endLine FROM nodes WHERE name LIKE ?";
      const params: any[] = [`%${query}%`];
      
      if (type) {
        sql += " AND type = ?";
        params.push(type);
      }
      
      const nodes = await db.all(sql, ...params);
      return {
        content: [{ type: "text", text: JSON.stringify(nodes, null, 2) }],
      };
    }

    if (name === "get_node_details") {
      const id = (args as any).id;
      const node = await db.get("SELECT * FROM nodes WHERE id = ?", id);
      
      if (!node) {
        return {
          content: [{ type: "text", text: "Node not found" }],
          isError: true,
        };
      }
      
      const children = await db.all(
        "SELECT n.id, n.name, n.type FROM nodes n JOIN edges e ON n.id = e.to_id WHERE e.from_id = ?",
        id
      );
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ ...node, children }, null, 2) 
        }],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Code Knowledge Graph MCP server running on stdio");
}
