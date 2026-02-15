export const sender = 'contact@elasticdash.com';
export const senderName = 'Team ElasticDash';
export const promptIdentifierClaude = `You are tasked with analyzing a message to identify four specific attributes of a coding change. The attributes are:\n\n1. Expected input\n2. Expected output\n3. Which part needs to be changed\n4. How that part shall be changed\n\nHere is the message to be analyzed:\n\n<message>\n{{MESSAGE}}\n</message>\nCarefully read through the message and identify any information related to these four attributes. For each attribute:\n\n- If you find relevant information, provide a summarized version of it.\n- If the attribute is mentioned but the user states \"I don't know\" or something similar, consider it as a valid attribute (except for \"expected output\").\n- If you cannot find any information about the attribute in the message, mark it as \"not provided\".\n\nPresent your analysis in the following format:\n\n<analysis>\n<expected_input>\n[Summarized expected input or \"not provided\"]\n</expected_input>\n\n<expected_output>\n[Summarized expected output or \"not provided\"]\n</expected_output>\n\n<part_to_change>\n[Summarized description of the part that needs to be changed or \"not provided\"]\n</part_to_change>\n\n<how_to_change>\n[Summarized description of how the part should be changed or \"not provided\"]\n</how_to_change>\n</analysis>\n\nRemember, even if the user says \"I don't know\" for any attribute (except \"expected output\"), still include this information in your summary rather than marking it as \"not provided\". Remove any explanation of the result.`;
export const PAGE_SIZE = 36;
export const optimizedPromptTemplate = `You are an AI agent tasked with assisting in modifying or creating APIs in a structured codebase. Follow these steps carefully:

1. **Understand the Repository Context**:
    - Read the \`general_context.md\` file to understand the overall structure and purpose of the repository.
    - Familiarize yourself with the conventions and guidelines mentioned in the file.

2. **Locate Relevant Files**:
    - Identify the relevant API endpoint or functionality mentioned in the task.
    - Navigate to the corresponding files in the repository. For example:
      - Endpoints are located in \`services/**.js\`.
      - Data processing logic is in \`controllers/**.js\`.
      - Database structure is defined in \`init.sql\`.

3. **Analyze Existing Code**:
    - Before making any changes, carefully read the existing code in the identified files.
    - Ensure you understand the current implementation and its dependencies.
    - Identify the programming language and technology stack used in the project.

4. **Analyze Dependencies**:
    - IMPORTANT: Locate and examine the dependency management files based on the identified technology stack:
      - For JavaScript/Node.js: package.json
      - For Python: requirements.txt or Pipfile
      - For Java: pom.xml or build.gradle
      - For other languages: the appropriate dependency management file
    - Review all existing dependencies that are already installed in the project.
    - You must NOT introduce new external dependencies unless absolutely necessary.
    - If you believe a new dependency is essential, you must explicitly justify why existing libraries cannot fulfill the requirement.

5. **Perform the Task**:
    - Modify or create the API as per the provided prompt or requirements.
    - Ensure that your changes align with the repository's structure and coding standards.
    - Use only the existing libraries and dependencies in the project whenever possible.
    - If functionality requires a dependency not present in package.json, first attempt to implement it using native Node.js or existing libraries.
    - Avoid making changes to unrelated parts of the codebase.

6. **Validation**:
    - Ensure that the modified or newly created API meets the requirements specified in the prompt.
    - Double-check that all relevant files (\`services/**.js\`, \`controllers/**.js\`, \`init.sql\`) are updated accordingly.
    - Verify that your implementation doesn't introduce unnecessary dependencies.

7. **Output**:
    - Provide the modified or newly created code snippet.
    - Include a brief explanation of the changes made, including any dependency decisions.
    - If new dependencies were needed, explain why existing ones couldn't fulfill the requirements.

Here is the task prompt for your reference:

__COMMAND__`;


export const identifyKeyPointsSystemMessage = `You are an expert tasked with analyzing a given task to identify the key points explicitly stated in the task description.

**Objective**: Carefully analyze the task description and extract the critical elements explicitly mentioned in the task for achieving its goal.

**Instructions**:
1. Read the task description carefully.
2. Identify and extract **key points** directly stated in the task description.
   - A **key point** is a critical element, condition, or step explicitly mentioned in the task description.
   - Do not infer or add any unstated elements.
   - Words such as "best," "highest," "cheapest," "latest," "most recent," "lowest," "closest," "highest-rated," "largest," and "newest" must go through the sort function(e.g., the key point should be "Filter by highest").

**Respond with**:
- **Key Points**: A numbered list of the explicit key points for completing this task, one per line, without explanations or additional details.`

export const testCaseRunAiCallResultEvaluationPrompt = {
  exact: `You are an expert software tester tasked with evaluating the results of an AI-generated API call within a test case run.

**Objective**: Analyze the AI call's input and output to determine if the output meets the expected results defined in the test case.

**Instructions**:
1. Review the provided **AI Call Input** and **AI Call Output**.
2. Compare the **AI Call Output** against the **Expected Output** criteria defined in the test case.
3. Determine if the output is correct based on the following:
    - If the output matches the expected result exactly (character by character, including whitespace and formatting), mark it as "passed".
    - If there are any differences, mark it as "failed" and provide a brief explanation of why it failed.

**Respond with**:
"passed" or The reason for failure.`,
  same_meaning: `You are evaluating whether an AI Call Output matches the Expected Output.

System rule (IMPORTANT):
- The assistant is the LLM itself and can only respond to the user.
- Any phrase like “greet the assistant” must be normalized to “assistant greets the user”.

Evaluation rules:
1) Compare meaning, not wording.
2) Ignore conversational direction for intents like greeting, thanking, acknowledging, or confirming.
3) Treat paraphrases, formatting differences, and order differences as equivalent.
4) Concepts are a set (extra non-contradictory concepts are OK).
5) [] and “None” in API Needs are equivalent.

**Respond with**:
"passed" or The reason for failure.`
};
