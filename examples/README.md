# Examples

This folder collects reference workflows and payloads that pair nicely with the Obsidian RAG ingestion stack. The `n8n` examples show how to consume the Supabase/Neo4j data as part of larger automations.

- `n8n/cache-export.workflow.json` – minimal workflow that polls the embedding cache overlay endpoint and sends the payload to a webhook (or downstream automation).

> Tip: copy the JSON into the n8n "Import from file" dialog, update the URLs/secrets, then connect the final node to whatever action you need (Telegram bot, Slack webhook, etc.).
