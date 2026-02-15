import { chatCompletion } from './openai.js';

const PLACEHOLDER_REGEX = /resolved_from_step_(\d+)/i;

export function containsPlaceholderReference(obj) {
    const pattern = PLACEHOLDER_REGEX;
    const malformedPattern = /\{\{(\d+)\.(\w+)\}\}/; // Matches {{11.id}}, {{1.name}}, etc.
    
    const check = (value) => {
        if (typeof value === 'string') {
            return pattern.test(value) || malformedPattern.test(value);
        }
        if (Array.isArray(value)) return value.some(check);
        if (value && typeof value === 'object') return Object.values(value).some(check);
        return false;
    };
    return check(obj);
}

export async function resolvePlaceholders(step, executedSteps) {
    // Handle multiple placeholder formats:
    // 1. resolved_from_step_N (standard format)
    // 2. {{resolved_from_step_N}} or {{resolved_from_step_N.field}}
    // 3. {{N.field}} where N is a number (malformed - treat as resolved_from_step_N.field)
    
    let placeholderStepNum = null;
    let needsResolution = false;
    
    // First pass: detect if we need resolution at all
    const detectPlaceholders = (value) => {
        if (typeof value === 'string') {
            // Standard format: resolved_from_step_N
            const m1 = value.match(PLACEHOLDER_REGEX);
            if (m1) {
                placeholderStepNum = parseInt(m1[1]);
                needsResolution = true;
                return;
            }
            // Malformed format: {{11.id}} - extract step number
            const m2 = value.match(/\{\{(\d+)\.(\w+)\}\}/);
            if (m2) {
                placeholderStepNum = parseInt(m2[1]);
                needsResolution = true;
                return;
            }
        } else if (Array.isArray(value)) {
            value.forEach(detectPlaceholders);
        } else if (value && typeof value === 'object') {
            Object.values(value).forEach(detectPlaceholders);
        }
    };
    
    detectPlaceholders(step);
    
    if (!needsResolution || !placeholderStepNum) return { resolved: true };

    const ref = executedSteps.find((s) =>
        s.step === placeholderStepNum || s.stepNumber === placeholderStepNum || s.step?.step_number === placeholderStepNum
    );
    if (!ref) return { resolved: false, reason: `Referenced step ${placeholderStepNum} not executed yet` };

    console.log(`\n📋 RESOLVING PLACEHOLDER: step ${placeholderStepNum}`);
    console.log(`   Referenced step response:`, JSON.stringify(ref.response).substring(0, 500));
    console.log(`   Current step needing resolution:`, JSON.stringify(step).substring(0, 500));

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return { resolved: false, reason: 'OpenAI API key not configured' };

    // Use LLM to intelligently extract and replace values
    const prompt = `You are resolving placeholder references in an API execution step.

**Current Step (needs placeholder resolution):**
\`\`\`json
${JSON.stringify(step, null, 2)}
\`\`\`

**Referenced Step ${placeholderStepNum} Response:**
\`\`\`json
${JSON.stringify(ref.response, null, 2)}
\`\`\`

**Task:**
1. Find all placeholder patterns in the current step:
   - \`resolved_from_step_${placeholderStepNum}\`
   - \`{{resolved_from_step_${placeholderStepNum}}}\`
   - \`{{resolved_from_step_${placeholderStepNum}.fieldName}}\`
   - \`{{${placeholderStepNum}.fieldName}}\` (malformed - treat as resolved_from_step_${placeholderStepNum}.fieldName)
2. Extract the appropriate value from the referenced step's response
3. Replace ALL occurrences of placeholders with actual values
4. For SQL responses: data is in \`result.rows[0]\`
5. For REST responses: data is directly in response or in \`data\` field
6. Handle field access like \`.id\` or \`.identifier\`

**Return ONLY valid JSON** with placeholders replaced by actual values:
\`\`\`json
${JSON.stringify(step, null, 2)}
\`\`\`

**Important:**
- Use actual values, not placeholders
- If extracting \`.id\` and value is \`{id: 11}\`, replace with \`11\` (not \`"{{11.id}}"\`)
- Preserve the structure exactly, only replace placeholder values
- For numbers, use numbers (not strings) unless the field expects a string`;

    try {
        const content = await chatCompletion({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            maxTokens: 1000,
        }).then((r) => r?.choices?.[0]?.message?.content?.trim() || '');

        if (!content) {
            return { resolved: false, reason: 'LLM returned empty response' };
        }

        // Extract JSON from code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        
        let resolvedStep;
        try {
            resolvedStep = JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse LLM response:', e);
            return { resolved: false, reason: 'Invalid JSON from LLM' };
        }

        // Update the original step with resolved values
        Object.assign(step, resolvedStep);
        
        console.log(`✅ Placeholder resolved successfully`);
        console.log(`   Resolved step:`, JSON.stringify(step).substring(0, 500));

        return { resolved: true };
    } catch (err) {
        console.error('Placeholder resolution failed:', err);
        return { resolved: false, reason: err.message || 'Failed to resolve placeholders' };
    }
}
