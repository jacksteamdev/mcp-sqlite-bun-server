# SQLite MCP Server

## Overview
A Model Context Protocol (MCP) server implementation that provides database interaction and business intelligence capabilities through SQLite. This server enables running SQL queries, analyzing business data, and automatically generating business insight memos.

## Installation

1. Install [Bun](https://bun.sh) if you haven't already
2. Clone this repository
3. Install dependencies:
   ```bash
   bun install
   ```
4. Run the setup script to configure the server in Claude Desktop:
   ```bash
   bun run setup
   ```

The setup script will automatically add the server configuration to your Claude Desktop config file, located at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

## Components

### Resources
The server exposes a single dynamic resource:
- `memo://insights`: A continuously updated business insights memo that aggregates discovered insights during analysis
  - Auto-updates as new insights are discovered via the append-insight tool

### Prompts
The server provides a demonstration prompt:
- `mcp-demo`: Interactive prompt that guides users through database operations
  - Required argument: `topic` - The business domain to analyze
  - Generates appropriate database schemas and sample data
  - Guides users through analysis and insight generation
  - Integrates with the business insights memo

### Tools
The server offers six core tools:

#### Query Tools
- `read-query`
   - Execute SELECT queries to read data from the database
   - Input:
     - `query` (string): The SELECT SQL query to execute
   - Returns: Query results as array of objects

- `write-query`
   - Execute INSERT, UPDATE, or DELETE queries
   - Input:
     - `query` (string): The SQL modification query
   - Returns: `{ affected_rows: number }`

- `create-table`
   - Create new tables in the database
   - Input:
     - `query` (string): CREATE TABLE SQL statement
   - Returns: Confirmation of table creation

#### Schema Tools
- `list-tables`
   - Get a list of all tables in the database
   - No input required
   - Returns: Array of table names

- `describe-table`
   - View schema information for a specific table
   - Input:
     - `table_name` (string): Name of table to describe
   - Returns: Array of column definitions with names and types

#### Analysis Tools
- `append-insight`
   - Add new business insights to the memo resource
   - Input:
     - `insight` (string): Business insight discovered from data analysis
   - Returns: Confirmation of insight addition
   - Triggers update of memo://insights resource

## Development

### Project Structure
- `src/index.ts`: Main server implementation
- `src/logger.ts`: Logging utility
- `scripts/setup.ts`: Claude Desktop configuration script

### Logging
The server maintains detailed logs in:
- `server.log`: Located in the project root directory
- Logs include timestamps, log levels (DEBUG, INFO, WARN, ERROR, FATAL), and structured metadata

### Database
The SQLite database file is created at:
- `data.sqlite`: Located in the project root directory
- Created automatically if it doesn't exist

### Available Scripts
- `bun run setup`: Configure the server in Claude Desktop
- `bun run lint`: Run ESLint checks
- `bun run lint:fix`: Fix ESLint issues automatically
- `bun run inspect`: Run the MCP inspector

## License

This MCP server is licensed under the MIT License. See the LICENSE file for details.