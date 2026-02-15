# Plan Refinement Prompt

REFINEMENT REQUEST (Attempt {{iteration}}/10):

User Goal: {{refinedQuery}}

Previous Plan Had This Issue: {{feedbackReason}}

Previous Plan:
{{planJson}}

IMPORTANT: You MUST fix the issue identified above. If the user requested creating/updating/deleting MULTIPLE items, the plan MUST include ALL operations as separate steps.

Available Resources: 
{{resources}}

Generate a COMPLETE and CORRECTED execution_plan that addresses the feedback above. Make sure ALL requested operations are included.
