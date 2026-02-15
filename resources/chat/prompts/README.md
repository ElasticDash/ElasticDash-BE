# Chat Prompt Templates

This directory contains all LLM prompts used by the chat planning and execution system. Prompts are stored as template files (.md) with variable placeholders for easy management and customization.

## Overview

Prompts are organized by their purpose in the planning and execution pipeline:

### Planning Phase Prompts
- **prompt-goal-completion-validator.md** - Validates if a goal is already completed based on available data
- **prompt-intent-analyzer.md** - Analyzes user intent and classifies as FETCH or MODIFY operation
- **prompt-plan-generation-fetch.md** - Generates read-only execution plans (queries)
- **prompt-plan-generation-modify.md** - Generates write/modify execution plans (mutations)
- **prompt-schema-validator.md** - Validates plan references against available database schemas
- **prompt-plan-validator.md** - Strict validation that plan meets user's goal requirements
- **prompt-plan-refinement.md** - Refines incomplete plans based on validation feedback

### Execution Phase Prompts
- **prompt-goal-achievement-validator.md** - Post-execution validation that goal was actually achieved
- **prompt-final-answer.md** - Synthesizes execution results into user-friendly answer
- **prompt-post-execution-replan.md** - Creates new plan when goal not met after execution

### System Prompts (Legacy)
- **prompt-planner.txt** - System instructions for planning phase (loaded by prompts.js)
- **prompt-planner-table.txt** - System instructions for table-focused queries (loaded by prompts.js)
- **prompt-executor.txt** - System instructions for execution phase
- **prompt-verifier.txt** - System instructions for verification phase

## Variable Placeholders

All .md templates use `{{variableName}}` syntax for placeholders. Variables are replaced by the prompt loader before sending to LLM.

### Common Variables

**Goal-related:**
- `{{refinedQuery}}` - User's goal/query
- `{{conversationContext}}` - Previous conversation history
- `{{conversationContextHeader}}` - Context with "CONTEXT:" prefix if available

**Data-related:**
- `{{usefulData}}` - Extracted data from previous executions
- `{{resources}}` - Available APIs and database schemas (JSON)
- `{{executionContext}}` - Serialized results from execution
- `{{dataContext}}` - Formatted data from execution steps

**Plan-related:**
- `{{planJson}}` - Complete execution plan as JSON
- `{{stepCount}}` - Number of steps in plan
- `{{stepsList}}` - List of plan steps with descriptions
- `{{forceFullPlanNote}}` - Note to regenerate full plan if needed

**Execution-related:**
- `{{executedStepsList}}` - List of executed steps
- `{{completedItems}}` - Items that were completed
- `{{missingItems}}` - Items still missing
- `{{completedItemsList}}` - Comma-separated completed items
- `{{missingItemsList}}` - Comma-separated missing items
- `{{iteration}}` - Current iteration number (1-10)

**Feedback-related:**
- `{{feedbackReason}}` - Reason why plan validation failed

## Usage

### Loading Templates

Prompts are loaded using `promptLoader.js`:

```javascript
import { loadPromptTemplate } from './controller/chat/promptLoader.js';

// Load and render a template
const prompt = loadPromptTemplate('prompt-plan-validator.md', {
    refinedQuery: 'Create 3 teams',
    stepCount: 2,
    stepsList: 'Step 1: Create Fire Team\nStep 2: Validate',
    planJson: '{"execution_plan": [...]}'
});
```

### Helper Functions

`promptLoader.js` provides helper functions to build common variable sets:

```javascript
import { 
    buildPlanValidationVars,
    buildGoalValidationVars,
    buildReplanVars 
} from './controller/chat/promptLoader.js';

// Build variables for plan validation
const vars = buildPlanValidationVars(plan, refinedQuery);

// Build variables for goal validation post-execution
const vars = buildGoalValidationVars(refinedQuery, executedSteps, executionContext);

// Build variables for replanning
const vars = buildReplanVars({
    refinedQuery,
    executedSteps,
    executionContext,
    goalValidation,
    ragResults,
    iteration,
});
```

## Best Practices

### Adding New Prompts

1. Create a new .md file in this directory: `prompt-{purpose}.md`
2. Include descriptive comments and instructions for the LLM
3. Use `{{variable}}` placeholders for dynamic content
4. Document the variables needed in this README
5. Create/update helper functions in `promptLoader.js` for common variable patterns
6. Use the template in code via `loadPromptTemplate()`

### Template Format

Good prompt templates:
- **Have a clear purpose** - Stated at the beginning
- **Include examples** - Show right/wrong patterns
- **Use placeholders** - Never hardcode data
- **Include instructions** - Clear validation or formatting rules
- **Are concise** - Remove redundant sections

Example:
```markdown
# Goal Validator Prompt

You are a strict goal validator. Check if the execution results meet the user's goal.

USER GOAL: {{refinedQuery}}

RESULTS:
{{executionContext}}

Return JSON with: { "achieved": true/false, "reason": "..." }
```

### Temperature and Token Limits

Different prompts use different LLM parameters:
- **Validation** (0.1 temp) - Low temperature for strict, consistent checking
- **Generation** (0.5 temp) - Medium temperature for creative planning
- **Synthesis** (0.3 temp) - Lower temperature for faithful summarization

These are set in the calling code, not in templates.

## Maintenance

### Updating Prompts

To improve a prompt:
1. Edit the .md file directly
2. Test changes by running the planner with test cases
3. Document any new variables needed
4. Update helper functions if variable patterns change

### Variable Naming

- Use camelCase for variable names: `{{refinedQuery}}` not `{{refined_query}}`
- Be descriptive: `{{executedStepsList}}` not `{{steps}}`
- Prefix conditionally included text: `{{conversationContextHeader}}` includes "CONTEXT:" prefix

## System Prompts (Legacy)

The older .txt files are loaded via `prompts.js`:

```javascript
import { loadPrompt } from './prompts.js';

const systemPrompt = loadPrompt('prompt-planner.txt');
```

These should eventually be migrated to template format for consistency.

## References

- **Prompt Loader**: `controller/chat/promptLoader.js`
- **Planner**: `controller/chat/planner.js` (uses templates)
- **Completion**: `controller/chat/completion.js`
- **Prompts Service**: `controller/chat/prompts.js` (legacy loader)
