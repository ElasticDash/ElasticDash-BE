# Plan Generation User Prompt (MODIFY Intent)

{{conversationContextHeader}}User Goal: {{refinedQuery}}

## Bulk Operations - TWO MODES

### Mode 1: Known Count (e.g., "create 3 teams")
If the user specifies an exact count (e.g., "create 3 teams", "delete 5 items"):
- Output ALL individual steps in execution_plan
- Step 1: Create team 1
- Step 2: Create team 2
- Step 3: Create team 3
- Step 4: Validation query
- **Total steps = count + 1 validation step**

### Mode 2: Unknown Count (e.g., "delete all teams", "remove all expired items")
If the user says "all" or the count is unknown, use LOOP SYNTAX.

**Loop Step Structure Examples:**

**DELETE Request (with path parameter):**
```json
{
  "step_number": 2,
  "description": "Delete each team",
  "loop": {
    "over": "resolved_from_step_1",
    "extractPath": "$.result.rows[*]",
    "as": "team"
  },
  "api": {
    "path": "/pokemon/teams/{teamId}",
    "method": "DELETE",
    "parameters": {
      "teamId": "{{team.id}}"
    }
  }
}
```

**POST Request (with requestBody):**
```json
{
  "step_number": 2,
  "description": "Add each Pokemon to watchlist",
  "loop": {
    "over": "resolved_from_step_1",
    "extractPath": "$.result.rows[*]",
    "as": "pokemon"
  },
  "api": {
    "path": "/pokemon/watchlist",
    "method": "POST",
    "requestBody": {
      "pokemonId": "{{pokemon.id}}",
      "notes": "{{pokemon.name}}"
    }
  }
}
```

**PUT Request (with both path parameter and requestBody):**
```json
{
  "step_number": 2,
  "description": "Update each team's name",
  "loop": {
    "over": "resolved_from_step_1",
    "extractPath": "$.result.rows[*]",
    "as": "team"
  },
  "api": {
    "path": "/pokemon/teams/{teamId}",
    "method": "PUT",
    "parameters": {
      "teamId": "{{team.id}}"
    },
    "requestBody": {
      "teamName": "Updated {{team.name}}"
    }
  }
}
```

**How Loops Work:**
1. `"over": "resolved_from_step_1"` - Takes results from Step 1
2. `"extractPath": "$.results[*].id"` - Extracts the `id` field from each result in the results array
   - For SQL queries: Use `$.results[*].fieldName` (SQL returns `{results: [...]}`)
   - For REST APIs: Use `$.fieldName` or `$[*].fieldName` depending on response structure
3. `"as": "teamId"` - Names the loop variable (use in {{teamId}})
4. The executor automatically expands this to multiple API calls, one for each item

**IMPORTANT RULES FOR LOOPS:**
- ✅ Use loop syntax for "all X", "every X", or "delete/remove all" requests
- ✅ Use loop syntax when the count is unknown at plan time
- ✅ Always include a Query step BEFORE the loop to fetch items
- ✅ Use correct extractPath based on response format:
  - SQL queries: `"$.results[*].fieldName"` (data is nested under results key)
  - REST APIs: `"$.data[*].fieldName"` or `"$[*].fieldName"` depending on API structure
- ✅ Use `"{{variableName}}"` in path/body to reference the loop variable
- ✅ Include validation step AFTER loop to verify completion
- ❌ Do NOT use loops with fixed counts (use individual steps instead)
- ❌ Do NOT use `$.fieldName` for SQL queries - always use `$.results[*].fieldName`

## Regular Step Structure (Non-Loop)

**For POST/PUT requests, you MUST include `requestBody`:**

**CRITICAL - Placeholder Format:**
- ✅ Use `{{resolved_from_step_N.field}}` to reference step results (e.g., `{{resolved_from_step_1.id}}`)
- ❌ NEVER use actual values as placeholders (e.g., `{{11.id}}` is WRONG - 11 is the value, not a step reference)
- ❌ NEVER mix value and placeholder (if you have the actual value like `11`, use it directly, don't wrap in `{{}}`)
- If step 1 returns `{id: 11}`, use either:
  - `"pokemonId": "{{resolved_from_step_1.id}}"` (placeholder - will be resolved at execution)
  - `"pokemonId": 11` (if you know the value at plan time)

**POST with requestBody:**
```json
{
  "step_number": 2,
  "description": "Add Metapod to watchlist",
  "api": {
    "path": "/pokemon/watchlist",
    "method": "POST",
    "requestBody": {
      "pokemonId": "{{resolved_from_step_1.id}}",
      "identifier": "{{resolved_from_step_1.identifier}}"
    }
  }
}
```

**PUT with path parameter and requestBody:**
```json
{
  "step_number": 2,
  "description": "Update team name",
  "api": {
    "path": "/pokemon/teams/{teamId}",
    "method": "PUT",
    "parameters": {
      "teamId": "{{resolved_from_step_1.id}}"
    },
    "requestBody": {
      "teamName": "New Team Name",
      "description": "Updated description"
    }
  }
}
```

**DELETE with path parameter:**
```json
{
  "step_number": 2,
  "description": "Delete team",
  "api": {
    "path": "/pokemon/teams/{teamId}",
    "method": "DELETE",
    "parameters": {
      "teamId": "{{resolved_from_step_1.id}}"
    }
  }
}
```

**GET with query parameters:**
```json
{
  "step_number": 1,
  "description": "Fetch team details",
  "api": {
    "path": "/pokemon/teams/{teamId}",
    "method": "GET",
    "parameters": {
      "teamId": "123"
    }
  }
}
```

IMPORTANT: If the user requested creating/updating/deleting MULTIPLE items with KNOWN counts (e.g., "create 3 teams named X, Y, Z"), you MUST output ALL operations in the execution_plan array. For "create 3 teams", output 3 separate CREATE steps (not 1, not 2, but all 3), plus 1 validation step at the end (total 4 steps minimum).

**CRITICAL - Use ONLY Resources Below**:
- **Table names**: Use EXACT names from resources. If you see "UserPokemonTeams" → use "UserPokemonTeams", NOT "pokemon_teams" or "PokemonTeams".
- **API endpoints**: Use EXACT paths from resources. If you see "/pokemon/allteams" → use "/pokemon/allteams", NOT "/pokemon/teams" or "/teams".
- **API methods**: Use EXACT methods shown. If you see "DELETE /pokemon/allteams" → use that, NOT "DELETE /pokemon/teams".
- DO NOT invent, guess, or modify any table/API names. If a resource is not listed below, you CANNOT use it.

Generate the COMPLETE execution_plan (resolution via SQL + mutation via REST) with zero placeholders (except loop variables).

Available Resources: 
{{resources}}

Useful Data: {{usefulData}}{{forceFullPlanNote}}

