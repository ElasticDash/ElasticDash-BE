# Post-Execution Replanning Prompt

POST-EXECUTION REPLANNING (Iteration {{iteration}}/10):

Original User Goal: {{refinedQuery}}

EXECUTION SUMMARY:
Previous steps that were executed:
{{executedStepsList}}

Completed Items:
{{completedItems}}

Missing Items That Still Need To Be Completed:
{{missingItems}}

Execution Context (actual data from responses):
{{executionContext}}

The user's goal was NOT fully achieved. The previous execution completed some items but is still missing: {{missingItemsList}}

IMPORTANT: 
1. Avoid duplicating already completed items ({{completedItemsList}})
2. Focus ONLY on completing the missing items: {{missingItemsList}}
3. If you reference results from previous steps, use "resolved_from_step_X" placeholders
4. Generate a minimal plan that completes ONLY what's missing
5. If the user requested creating/updating/deleting MULTIPLE items in missing items, ALL must be included as separate steps

Available Resources: 
{{resources}}

Generate a COMPLETE execution_plan that addresses ONLY the missing items. Make sure ALL requested missing operations are included.
