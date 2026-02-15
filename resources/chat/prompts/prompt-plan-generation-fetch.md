# Plan Generation User Prompt (FETCH Intent)

{{conversationContextHeader}}User Goal: {{refinedQuery}}

Generate a read-only execution_plan (SQL via /general/sql/query) with zero placeholders.

**CRITICAL - Use ONLY Resources Below**:
- **Table names**: Use EXACT names from resources. If you see "UserPokemonTeams" → use "UserPokemonTeams", NOT "pokemon_teams" or "PokemonTeams".
- **API endpoints**: Use EXACT paths from resources. If you see "/pokemon/allteams" → use "/pokemon/allteams", NOT "/pokemon/teams" or "/teams".
- DO NOT invent, guess, or modify any table/API names. If a resource is not listed below, you CANNOT use it.

Available Resources: 
{{resources}}

Useful Data: {{usefulData}}
