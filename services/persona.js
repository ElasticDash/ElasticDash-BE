import express from 'express';
import personaController from '../controller/persona/personaController.js';
import { t } from '../src/constants.js';
import {
  generalApiResponseSender,
  generalApiErrorHandler
} from '../controller/general/tools.js';

const router = express.Router();

// List all personas
router.get('/', async (req, res) => {
  console.log('api: GET /persona');
  console.log('Calling: listPersonas');
  try {
    const personas = await personaController.listPersonas();
    generalApiResponseSender(res, personas);
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});

// Create a new persona (manual)
router.post('/', async (req, res) => {
  console.log('api: POST /persona');
  console.log('Calling: createPersona');
  try {
    const { name, description } = req.body;
    if (!name) return generalApiErrorHandler(res, { status: 400, message: t('persona.invalidInput') });
    const persona = await personaController.createPersona({ name, description, is_preset: false });
    generalApiResponseSender(res, persona);
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});

// Delete a persona
router.delete('/:id', async (req, res) => {
  console.log('api: DELETE /persona/' + req.params.id);
  console.log('Calling: deletePersona');
  try {
    await personaController.deletePersona(req.params.id);
    generalApiResponseSender(res, { success: true });
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});

// Estimate persona for a conversation (auto)
router.post('/estimate', async (req, res) => {
  console.log('api: POST /persona/estimate');
  console.log('Calling: estimatePersonaWithLLM');
  try {
    const { external_id } = req.body;
    if (!external_id) return generalApiErrorHandler(res, { status: 400, message: t('persona.invalidInput') });
    // Fetch conversation from logger DB
    const conversation = await personaController.fetchConversationFromLogger(external_id);
    // Store conversation locally
    const storedConv = await personaController.storeConversation({ external_id, content: conversation.content });
    // Estimate persona
    const persona = await personaController.estimatePersonaWithLLM(conversation.content);
    // Find or create persona in DB
    let personaRecord = (await personaController.listPersonas()).find(p => p.name === persona.name);
    if (!personaRecord) {
      personaRecord = await personaController.createPersona({ name: persona.name, description: persona.description, is_preset: true });
    }
    // Store mapping
    await personaController.storePersonaConversation({ persona_id: personaRecord.id, conversation_id: storedConv.id, estimated_by_llm: true });
    generalApiResponseSender(res, { persona: personaRecord, conversation: storedConv });
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});

export { router as persona };
