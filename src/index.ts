import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { Database } from 'bun:sqlite';
import logger from './logger';
import { createMcpDemoPrompt } from './prompts';
import { join } from 'node:path';

// Store insights in memory
const insights: string[] = [];

// Initialize SQLite database
const db = new Database(join(import.meta.dirname, '../data.sqlite'), {
  create: true,
});

// Create MCP Server
const server = new Server(
  {
    name: 'sqlite-manager',
    version: '0.1.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  },
);

// Synthesize memo from insights
const synthesizeMemo = () => {
  if (insights.length === 0) {
    return 'No business insights have been discovered yet.';
  }

  const insightsList = insights.map((i) => `- ${i}`).join('\n');
  return (
    `📊 Business Intelligence Memo 📊\n\n` +
    `Key Insights Discovered:\n\n${insightsList}\n\n` +
    `Summary:\n` +
    `Analysis has revealed ${insights.length} key business insights that suggest opportunities for strategic optimization and growth.`
  );
};

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  logger.debug('Handling ListResourcesRequest');
  const response = {
    resources: [
      {
        uri: 'memo://insights',
        name: 'Business Insights Memo',
        description: 'A living document of discovered business insights',
        mimeType: 'text/plain',
      },
    ],
  };
  logger.debug('ListResources response', {
    resources: response.resources.length,
  });
  return response;
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  logger.debug('Handling ReadResourceRequest', { uri: request.params.uri });
  const uri = new URL(request.params.uri);
  if (uri.protocol !== 'memo:') {
    logger.error('Invalid protocol', { protocol: uri.protocol });
    throw new Error('Unsupported protocol');
  }
  if (uri.hostname !== 'insights') {
    logger.error('Unknown resource', { hostname: uri.hostname });
    throw new Error('Unknown resource');
  }

  const memo = synthesizeMemo();
  logger.debug('Generated memo', {
    length: memo.length,
    insights: insights.length,
  });
  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: 'text/plain',
        text: memo,
      },
    ],
  };
});

const mcpDemoPromptRequestSchema = type({
  name: '"mcp-demo"',
  arguments: {
    topic: type('string').describe(
      'Topic to seed the database with initial data',
    ),
  },
}).describe('a demo prompt for SQLite MCP Server');

// Prompt handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  logger.debug('Handling ListPromptsRequest');
  const response = {
    prompts: [
      {
        name: 'mcp-demo',
        description: mcpDemoPromptRequestSchema.description,
        arguments: [
          {
            name: 'topic',
            description: 'Topic to seed the database with initial data',
            required: true,
          },
        ],
      },
    ],
  };
  logger.debug('ListPrompts response', { prompts: response.prompts.length });
  return response;
});

const promptParamsSchema = mcpDemoPromptRequestSchema;

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  logger.debug('Handling GetPromptRequest', { params: request.params });
  const {
    arguments: { topic },
  } = promptParamsSchema.assert(request.params);
  logger.info('Generating prompt for topic', { topic });

  return {
    description: `Demo template for ${topic}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: createMcpDemoPrompt(topic),
        },
      },
    ],
  };
});

const readQueryParamsSchema = type({
  name: '"read-query"',
  arguments: {
    query: type(/^SELECT/i).describe('a SELECT query'),
  },
}).describe('Execute a read-only SQL query');

const writeQueryParamsSchema = type({
  name: '"write-query"',
  arguments: {
    query: type(/^(INSERT|UPDATE|DELETE)/i).describe(
      'an INSERT, UPDATE, or DELETE query',
    ),
  },
}).describe('Execute a write SQL query');

const createTableParamsSchema = type({
  name: '"create-table"',
  arguments: {
    query: type(/^CREATE TABLE/i).describe('a CREATE TABLE statement'),
  },
}).describe('Create a new table in the database');

const listTablesParamsSchema = type({
  name: '"list-tables"',
  arguments: {},
}).describe('List all tables in the database');

const describeTableParamsSchema = type({
  name: '"describe-table"',
  arguments: {
    table_name: 'string',
  },
}).describe('Get schema information for a table');

const appendInsightParamsSchema = type({
  name: '"append-insight"',
  arguments: {
    insight: 'string',
  },
}).describe('Add a business insight to the memo');

const validParams = readQueryParamsSchema
  .or(writeQueryParamsSchema)
  .or(createTableParamsSchema)
  .or(listTablesParamsSchema)
  .or(describeTableParamsSchema)
  .or(appendInsightParamsSchema);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'read-query',
      description: readQueryParamsSchema.description,
      inputSchema: readQueryParamsSchema.get('arguments').toJsonSchema(),
    },
    {
      name: 'write-query',
      description: writeQueryParamsSchema.description,
      inputSchema: writeQueryParamsSchema.get('arguments').toJsonSchema(),
    },
    {
      name: 'create-table',
      description: createTableParamsSchema.description,
      inputSchema: createTableParamsSchema.get('arguments').toJsonSchema(),
    },
    {
      name: 'list-tables',
      description: listTablesParamsSchema.description,
      inputSchema: listTablesParamsSchema.get('arguments').toJsonSchema(),
    },
    {
      name: 'describe-table',
      description: describeTableParamsSchema.description,
      inputSchema: describeTableParamsSchema.get('arguments').toJsonSchema(),
    },
    {
      name: 'append-insight',
      description: appendInsightParamsSchema.description,
      inputSchema: appendInsightParamsSchema.get('arguments').toJsonSchema(),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.debug('Handling CallToolRequest', {
    tool: request.params.name,
    args: request.params.arguments,
  });

  try {
    const { name, arguments: args } = validParams.assert(request.params);

    switch (name) {
      case 'read-query': {
        logger.info('Executing read query', { query: args.query });
        const results = db.query(args.query).all();
        logger.debug('Read query results', { rows: results.length });
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      }

      case 'write-query': {
        logger.info('Executing write query', { query: args.query });
        const result = db.run(args.query);
        logger.debug('Write query results', { affected: result.changes });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ affected_rows: result.changes }),
            },
          ],
        };
      }

      case 'create-table': {
        logger.info('Creating table', { query: args.query });
        db.run(args.query);
        logger.debug('Table created successfully');
        return {
          content: [{ type: 'text', text: 'Table created successfully' }],
        };
      }

      case 'list-tables': {
        logger.debug('Listing tables');
        const results = db
          .query('SELECT name FROM sqlite_master WHERE type="table"')
          .all();
        logger.debug('Tables found', { count: results.length });
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      }

      case 'describe-table': {
        logger.debug('Describing table', { table: args.table_name });
        const results = db.query(`PRAGMA table_info(${args.table_name})`).all();
        logger.debug('Table schema', { columns: results.length });
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      }

      case 'append-insight': {
        logger.info('Adding new insight', { insight: args.insight });
        insights.push(args.insight);
        await server.sendResourceUpdated({ uri: 'memo://insights' });
        logger.debug('Insight added successfully', { total: insights.length });
        return { content: [{ type: 'text', text: 'Insight added' }] };
      }

      // ... other tool handlers
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.error('Tool execution error', {
        error: err.message,
        stack: err.stack,
      });
    } else if (err instanceof type.errors) {
      logger.error('Validation error', {
        summary: err.summary,
        details: err.issues,
      });
    }
    throw err;
  }
});

async function startServer() {
  logger.info('Initializing server...');
  const transport = new StdioServerTransport();

  try {
    logger.info('Connecting to transport...');
    await server.connect(transport);
    logger.info('Server started successfully');
  } catch (err) {
    logger.fatal('Failed to start server', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

startServer().catch(console.error);
