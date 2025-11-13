# Installation Guide

> Obsidian RAG is an **ingestion-first** plugin. It pushes your vault into Supabase (vectors) and Neo4j (graph) so you can query those systems from n8n, bots, or scripts you control.

## For Normal Users

### Prerequisites

Before you begin, ensure you have:
- [Obsidian](https://obsidian.md/) installed
- A [Supabase](https://supabase.com) account
- Access to an [Ollama](https://ollama.com/) server (local or remote)
- *(Optional)* An [OpenAI](https://platform.openai.com/) API key for fallback embeddings
- *(Optional)* A [Neo4j 5.x](https://neo4j.com/) instance (Desktop, Docker, or Aura) if you want graph sync
- *(Optional)* A generative Ollama model such as `llama3` (run `ollama pull llama3`) if you plan to enable advanced entity extraction
- Node.js **18 or newer** if you plan to run the Makefile or developer tooling (the repo will block older runtimes)

### Installation Steps

1. **Install the Plugin**

   #### Method 1: Through Obsidian (Recommended)
   - Open Obsidian Settings
   - Go to Community Plugins
   - Search for "Obsidian RAG"
   - Click Install and Enable

   #### Method 2: Manual Installation
   - Download the latest release from [GitHub Releases](https://github.com/smpl-ai-automations/obsidian-rag/releases)
   - Extract the files to your vault's plugins directory:
     ```
     .obsidian/plugins/obsidian-rag/
     ```
   - Restart Obsidian
   - Enable the plugin in Community Plugins settings

2. **Set Up Supabase**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - In **Project Settings → API**, copy the **Project URL** (this becomes the `Supabase URL` field in the plugin).
   - In the same screen, copy the **Service Role API key** (labeled `service_role`). Obsidian RAG performs authenticated inserts/updates into `documents`, `obsidian_file_status`, and `entities`, so the anon key cannot bypass Row Level Security for those writes.
   - *(Optional)* If you're also preparing local tooling, paste these values into [`SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.template`](.env.template) so your CLI scripts match the plugin configuration.
   - You do **not** need the database password for the in-app configuration—keep it for direct Postgres access or Makefile helpers only.
   - Run [`sql/setup.sql`](sql/setup.sql) (or `make setup-db`) once per project to create the shared `documents` table, vector indexes, and helper policies. The plugin now takes over the `obsidian_file_status` + `entities` tables automatically, but it still expects the base schema to exist.

3. **Configure the Plugin**
   - Open Obsidian RAG settings in Obsidian
   - Enter your Supabase credentials:
     - **Supabase URL** (paste the Project URL you copied earlier)
     - **Supabase API Key** (paste the `service_role` key)
   - Choose a **Sync Mode** under *Settings → Sync*:
     - **Supabase** – vectors only
     - **Neo4j** – graph only
     - **Hybrid** – run both stages (default `vector-first` order)
   - Configure Neo4j (if you enabled Graph or Hybrid modes):
     - Bolt URL (e.g., `bolt://localhost:7687`)
     - Username & password
     - Database name (defaults to `neo4j`)
     - Project name (one per vault to keep graphs isolated)
   - Configure the Embeddings section:
     - Confirm the Ollama server URL and model (defaults to `http://localhost:11434` and `nomic-embed-text`)
     - Enable or disable Ollama usage as needed
     - (Optional) Provide an OpenAI API key to enable fallback embedding generation
   - Configure the **LLM & Entity Extraction** section (optional):
     - Set the LLM model used for prompts (e.g., `llama3`)
     - Toggle advanced extraction, adjust entity types, and add regex-based custom rules as needed
   - Click "Initialize Database" to create the required tables
     - The plugin automatically provisions `obsidian_file_status` and `entities` if Supabase reports "relation does not exist" by replaying the SQL stored in `sql/setup.sql`.
     - If your Supabase instance blocks the `execute_sql` RPC entirely, the plugin will fall back to a REST call and then raise an actionable error telling you to paste the schema block from `sql/setup.sql` (or run `make setup-db`) to finish the migration manually.

4. **Trigger & Verify Sync**
   - The plugin automatically watches your vault and queues changes for ingestion.
   - Use the command palette commands (`Force sync current file`, `Force sync all files`, `Clear sync queue`, `Reset file tracker cache`, `Start/Stop initial sync`, `Show recent sync graph overlay`) to control or validate the workflow.
   - Configure exclusion patterns if needed to keep private folders out of Supabase/Neo4j.

### Choosing a Sync Mode
- **Supabase:** Only vector data is written. Useful when you just need semantic search or when Neo4j is offline.
- **Neo4j:** Only graph data is written. Skip the embedding cost if you only care about entities/relationships.
- **Hybrid:** Runs both stages (vector-first by default). The queue pauses automatically if either backend is unavailable and resumes when both reconnect, keeping vaults isolated.

Switch modes per vault whenever your automation needs change—Obsidian RAG records which backend received the latest successful write so n8n can decide how to query it.

## For Developers

### Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Yarn](https://yarnpkg.com/) package manager
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher)
- *(Optional)* [Neo4j 5.x](https://neo4j.com/) if you want to test graph sync locally
- [jq](https://stedolan.github.io/jq/) (for password encoding)
- [coreutils](https://www.gnu.org/software/coreutils/) (for timeout command)

The inspiration for this plugin came from watching Nate Herk's YouTube video [Step by Step: RAG AI Agents Got Even Better](https://youtu.be/wEXrbtqNIqI?t=323). This is great to watch to set up your Telegram Chatbot using n8n to connect to the Supabase database. I made an "Obsidian" workflow which I can plug into other n8n workflows to get information from my Obsidian vault in different scenarios. It has made retrieving knowledge from my vault so much easier and more practical in different use cases.

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/smpl-ai-automations/obsidian-rag.git
   cd obsidian-rag
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   - Copy `.env.template` to `.env`:
     ```bash
     cp .env.template .env
     ```
   - Update the `.env` file with your Supabase, Neo4j, and embedding settings:
     ```
     SUPABASE_URL=https://your-project-ref.supabase.co
     SUPABASE_DB_PASSWORD=your-database-password
     SYNC_MODE=hybrid   # supabase | neo4j | hybrid
     NEO4J_URL=bolt://localhost:7687
     NEO4J_USERNAME=neo4j
     NEO4J_PASSWORD=your-neo4j-password
     NEO4J_DATABASE=neo4j
     NEO4J_PROJECT_NAME=obsidian-rag
     OLLAMA_URL=http://localhost:11434
     OLLAMA_MODEL=nomic-embed-text
     OPENAI_API_KEY=optional-openai-key
     ```
   - If the region is not obvious from `SUPABASE_URL`, add `SUPABASE_DB_REGION=eu-central-1` (or set `SUPABASE_DB_HOST`) so the Makefile targets can build the `aws-0-<region>.pooler.supabase.com` hostname automatically.

4. **Initialize the project**
   ```bash
   make init
   ```
   This command will:
   - Check for required tools
   - Verify environment variables
   - Test the database connection
   - Set up the database schema

### Available Commands

#### Development
- `make dev` - Start the development server
- `make test-db` - Test the database connection
- `make reset` - Reset and set up the database

#### Database Management
- `make install-postgres` - Install PostgreSQL if not already installed
- `make test-db` - Test the database connection
- `make reset` - Reset the database and run setup scripts

#### Release Management
- `make release` - Create a patch release (default)
- `make release-major` - Create a major release
- `make release-minor` - Create a minor release
- `make release-patch` - Create a patch release

The release workflow will:
1. Check for a clean working directory
2. Verify we're on the main branch
3. Bump the version number
4. Generate a changelog
5. Create and push a git tag

### Troubleshooting

#### Database Connection Issues

If you encounter database connection issues:

1. **Check IP Address Restrictions**
   - Run `make test-db` to see your current IP address
   - Add this IP to your Supabase project's network restrictions
   - Wait a few minutes for changes to take effect

2. **Verify Connection Details**
   - Ensure your `SUPABASE_URL` and `SUPABASE_DB_PASSWORD` are correct
   - Check if the project reference matches your Supabase dashboard
   - Verify there are no network restrictions or firewall rules blocking the connection

3. **Install Required Tools**
   If you see errors about missing commands:
   - `psql`: Install PostgreSQL with `make install-postgres`
   - `jq`: Install with `brew install jq`
   - `timeout`: Install with `brew install coreutils`

#### Release Issues

If you encounter issues during release:

1. **Working Directory Not Clean**
   - Commit or stash any changes before running release commands
   - Use `git status` to check for uncommitted changes

2. **Not on Main Branch**
   - Switch to the main branch with `git checkout main`
   - Ensure all changes are merged before releasing

3. **Version Bump Issues**
   - Check `manifest.json` and `package.json` for correct version format
   - Ensure you have write permissions to these files

### Support

If you encounter any issues not covered in this guide:
1. Check the error messages for specific details
2. Review the troubleshooting steps above
3. If the issue persists, please open an issue in the repository
