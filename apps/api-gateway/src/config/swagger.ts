import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Conversational Clone API',
      version: '1.0.0',
      description: 'REST API for managing conversational AI clones with voice and face cloning capabilities',
      contact: {
        name: 'API Support',
        email: 'support@conversational-clone.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://api-staging.conversational-clone.com/api/v1',
        description: 'Staging server'
      },
      {
        url: 'https://api.conversational-clone.com/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            subscriptionTier: { type: 'string', enum: ['free', 'pro', 'enterprise'] }
          }
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            filename: { type: 'string' },
            contentType: { type: 'string' },
            sizeBytes: { type: 'integer' },
            uploadedAt: { type: 'string', format: 'date-time' },
            processedAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            chunkCount: { type: 'integer' }
          }
        },
        VoiceModel: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            provider: { type: 'string', enum: ['xtts-v2', 'google-cloud-tts', 'openai-tts'] },
            qualityScore: { type: 'number', minimum: 0, maximum: 100 },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        FaceModel: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            qualityScore: { type: 'number', minimum: 0, maximum: 100 },
            createdAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
