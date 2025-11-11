/**
 * Voice Routes
 *
 * API routes for voice sample and voice model management.
 */

import { Router } from 'express';

import voiceController from '../../controllers/voice.controller';

const router: Router = Router();

// Voice Samples
router.post('/samples', voiceController.uploadVoiceSample);
router.get('/samples', voiceController.getVoiceSamples);
router.delete('/samples/:id', voiceController.deleteVoiceSample);

// Voice Models
router.post('/models', voiceController.createVoiceModel);
router.get('/models', voiceController.getVoiceModels);
router.get('/models/:id/progress', voiceController.getVoiceModelProgress);
router.put('/models/:id', voiceController.updateVoiceModel);
router.delete('/models/:id', voiceController.deleteVoiceModel);

export default router;
