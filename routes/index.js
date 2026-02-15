import express from 'express';
import { admin } from '../services/admin.js';
import { auth } from '../services/auth.js';
import { general } from '../services/general.js';
import { user } from '../services/user.js';
import { plan } from '../services/plan.js';
import { pokemon } from '../services/pokemon.js';
import { task } from '../services/task.js';
import { chat } from '../services/chat.js';
import { project } from '../services/project.js';
import { testCase } from '../services/testCase.js';
import { persona } from '../services/persona.js';
import { traces } from '../services/traces.js';
import { features } from '../services/features.js';
import traceAnalysis from '../services/traceAnalysis.js';

const router = express.Router();

router.use('/admin', admin);
router.use('/auth', auth);
router.use('/general', general);
router.use('/user', user);
router.use('/plan', plan);
router.use('/pokemon', pokemon);
router.use('/task', task); // Added task service routing
router.use('/chat', chat);
router.use('/project', project);
router.use('/testcases', testCase);
router.use('/persona', persona);
router.use('/traces', traces);
router.use('/features', features);
router.use('/trace-analysis', traceAnalysis);

export { router as root };
