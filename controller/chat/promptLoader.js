import fs from 'fs';
import path from 'path';

// Use process.cwd() for compatibility (works with babel-node and ESM)
const PROMPTS_DIR = path.join(process.cwd(), 'resources', 'chat', 'prompts');

/**
 * Load a prompt template from file and replace placeholders
 * @param {string} templateName - Name of the template file (e.g., 'prompt-goal-completion-validator.md')
 * @param {Object} variables - Object with variables to replace {{varName}} in template
 * @returns {string} Rendered prompt with placeholders replaced
 */
export function loadPromptTemplate(templateName, variables = {}) {
    const filePath = path.join(PROMPTS_DIR, templateName);
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`Prompt template not found: ${templateName} at ${filePath}`);
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Replace all {{variableName}} with values from the variables object
    content = content.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
        const trimmedVar = varName.trim();
        if (trimmedVar in variables) {
            const value = variables[trimmedVar];
            return value !== undefined && value !== null ? String(value) : '';
        }
        // If variable not provided, leave it as is (for debugging)
        console.warn(`[PromptLoader] Missing variable: {{${trimmedVar}}} in template ${templateName}`);
        return match;
    });

    return content;
}

/**
 * Load a prompt template and format it as a user message object
 * @param {string} templateName - Name of the template file
 * @param {Object} variables - Variables to replace in template
 * @returns {Object} Message object with {role: 'user', content: string}
 */
export function loadPromptAsUserMessage(templateName, variables = {}) {
    const content = loadPromptTemplate(templateName, variables);
    return { role: 'user', content };
}

/**
 * Load multiple variables for a template based on common patterns
 * Helper to avoid repetitive variable building
 */
export function buildPlanValidationVars(plan, refinedQuery) {
    const stepCount = (plan.execution_plan || []).length;
    const stepsList = (plan.execution_plan || [])
        .map((s, i) => `Step ${i + 1}: ${s.description || 'No description'}`)
        .join('\n');
    
    return {
        refinedQuery,
        stepCount,
        stepsList,
        planJson: JSON.stringify(plan, null, 2),
    };
}

/**
 * Load multiple variables for goal achievement validation
 */
export function buildGoalValidationVars(refinedQuery, executedSteps, executionContext) {
    const executedStepsList = executedSteps
        .map((s, i) => `${i + 1}. ${s.description} (${s.api?.method || 'POST'} ${s.api?.path || 'unknown'})`)
        .join('\n');

    return {
        refinedQuery,
        executionContext,
        executedStepsList,
    };
}

/**
 * Load multiple variables for post-execution replanning
 */
export function buildReplanVars({
    refinedQuery,
    executedSteps,
    executionContext,
    goalValidation,
    ragResults,
    iteration,
}) {
    let resources = '[]';
    if (ragResults && ragResults.length > 0) {
        const enrichedResults = ragResults.map((r) => {
            if (r.content && r.content.length > 0) {
                return {
                    name: r.name || r.id,
                    type: 'table_schema',
                    schema: r.content,
                };
            }
            return {
                name: r.name || r.id,
                endpoint: r.endpoint || r.path || '',
                method: r.method || '',
                type: 'api',
            };
        });
        resources = JSON.stringify(enrichedResults, null, 2);
    }

    const executedStepsList = executedSteps.map((s, i) => 
        `${i + 1}. [${s.api?.method || 'POST'} ${s.api?.path || 'N/A'}] ${s.description}`
    ).join('\n');

    const completedItems = (goalValidation.completedItems || []).map(item => `- ${item}`).join('\n');
    const missingItems = (goalValidation.missingItems || []).map(item => `- ${item}`).join('\n');
    const missingItemsList = (goalValidation.missingItems || []).join(', ');
    const completedItemsList = (goalValidation.completedItems || []).join(', ');

    return {
        iteration,
        refinedQuery,
        executedStepsList,
        completedItems,
        missingItems,
        completedItemsList,
        missingItemsList,
        executionContext,
        resources,
    };
}
