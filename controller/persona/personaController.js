import { pool } from '../../postgres';
import { chatCompletion } from '../chat/openai.js';
const presetPersonaList = require('./presetPersonaList');

const personaController = {
  // List all personas (preset + user-defined)
  async listPersonas() {
    const result = await pool.query('SELECT * FROM persona WHERE deleted = FALSE ORDER BY is_preset DESC, id ASC');
    return result.rows;
  },

  // Create a new persona (manual or preset)
  async createPersona({ name, description, is_preset = false, created_by = 0 }) {
    const result = await pool.query(
      `INSERT INTO persona (name, description, is_preset, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING *`,
      [name, description, is_preset, created_by]
    );
    return result.rows[0];
  },

  // Soft delete a persona
  async deletePersona(id, updated_by = 0) {
    await pool.query(
      `UPDATE persona SET deleted = TRUE, updated_at = NOW(), updated_by = $2 WHERE id = $1`,
      [id, updated_by]
    );
    return { success: true };
  },

  // Fetch conversation from logger DB (external)
  async fetchConversationFromLogger(external_id) {
    // Connect to external logger DB using DB_CONNECTION_LOGGER
    const { Pool } = require('pg');
    const loggerDbUrl = process.env.DB_CONNECTION_LOGGER;
    if (!loggerDbUrl) {
      throw new Error('DB_CONNECTION_LOGGER is not set');
    }
    const loggerPool = new Pool({ connectionString: loggerDbUrl });
    try {
      // Try to fetch conversation by external_id (assume table name is "conversation" and has external_id, content, created_at, created_by)
      const result = await loggerPool.query(
        'SELECT * FROM conversation WHERE external_id = $1 ORDER BY created_at DESC LIMIT 1',
        [external_id]
      );
      if (result.rows.length > 0) {
        // Return the latest conversation record
        return result.rows[0];
      } else {
        // Not found, return mock
        return {
          external_id,
          content: { messages: [] },
          created_at: new Date().toISOString(),
          created_by: 0
        };
      }
    } catch (err) {
      // On error, return mock
      return {
        external_id,
        content: { messages: [] },
        created_at: new Date().toISOString(),
        created_by: 0
      };
    } finally {
      await loggerPool.end();
    }
  },

  // Store conversation record locally
  async storeConversation({ external_id, content, created_by = 0 }) {
    const result = await pool.query(
      `INSERT INTO conversation (external_id, content, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [external_id, content, created_by]
    );
    return result.rows[0];
  },

  // Estimate persona using LLM (calls OpenAI)
  async estimatePersonaWithLLM(conversation, personaList = presetPersonaList) {
    // Build prompt for persona estimation
    const personaDescriptions = personaList.map((p, idx) => `${idx + 1}. ${p.name}: ${p.description}`).join('\n');
    const prompt = `Given the following conversation and a list of possible personas, select the most likely persona that matches the user.\n\nPersonas:\n${personaDescriptions}\n\nConversation:\n${JSON.stringify(conversation.content)}\n\nReply ONLY with the persona name from the list above that best matches the user. If none match, reply with 'Unknown'.`;
    const messages = [
      { role: 'system', content: 'You are an expert at user persona classification.' },
      { role: 'user', content: prompt }
    ];
    try {
      const res = await chatCompletion({ messages, model: process.env.OPENAI_DEFAULT_MODEL, temperature: 0 });
      const answer = res.choices?.[0]?.message?.content?.trim() || '';
      // Find the persona by name (case-insensitive)
      const matched = personaList.find(p => p.name.toLowerCase() === answer.toLowerCase());
      return matched || { name: answer, description: 'Unknown or custom persona' };
    } catch (err) {
      // Fallback: return first persona if LLM fails
      return personaList[0];
    }
  },

  // Store persona-conversation mapping
  async storePersonaConversation({ persona_id, conversation_id, estimated_by_llm = false, created_by = 0 }) {
    const result = await pool.query(
      `INSERT INTO persona_conversation (persona_id, conversation_id, estimated_by_llm, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [persona_id, conversation_id, estimated_by_llm, created_by]
    );
    return result.rows[0];
  }
};

export default personaController;
