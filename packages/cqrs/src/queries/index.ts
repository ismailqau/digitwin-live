import { Query } from '../types';

/**
 * Get User Query
 */
export interface GetUserQuery extends Query {
  queryType: 'user.get';
  payload: {
    userId: string;
  };
}

/**
 * Get User Profile Query
 */
export interface GetUserProfileQuery extends Query {
  queryType: 'user.get_profile';
  payload: {
    userId: string;
  };
}

/**
 * List Voice Models Query
 */
export interface ListVoiceModelsQuery extends Query {
  queryType: 'voice_model.list';
  payload: {
    userId: string;
  };
}

/**
 * Get Voice Model Query
 */
export interface GetVoiceModelQuery extends Query {
  queryType: 'voice_model.get';
  payload: {
    userId: string;
    voiceModelId: string;
  };
}

/**
 * List Face Models Query
 */
export interface ListFaceModelsQuery extends Query {
  queryType: 'face_model.list';
  payload: {
    userId: string;
  };
}

/**
 * Get Face Model Query
 */
export interface GetFaceModelQuery extends Query {
  queryType: 'face_model.get';
  payload: {
    userId: string;
    faceModelId: string;
  };
}

/**
 * List Documents Query
 */
export interface ListDocumentsQuery extends Query {
  queryType: 'document.list';
  payload: {
    userId: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    page?: number;
    pageSize?: number;
  };
}

/**
 * Get Document Query
 */
export interface GetDocumentQuery extends Query {
  queryType: 'document.get';
  payload: {
    userId: string;
    documentId: string;
  };
}

/**
 * Get Conversation Session Query
 */
export interface GetConversationSessionQuery extends Query {
  queryType: 'conversation.get_session';
  payload: {
    userId: string;
    sessionId: string;
  };
}

/**
 * List Conversation Sessions Query
 */
export interface ListConversationSessionsQuery extends Query {
  queryType: 'conversation.list_sessions';
  payload: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  };
}

/**
 * Get Conversation History Query
 */
export interface GetConversationHistoryQuery extends Query {
  queryType: 'conversation.get_history';
  payload: {
    userId: string;
    sessionId: string;
  };
}

/**
 * Get User Statistics Query
 */
export interface GetUserStatisticsQuery extends Query {
  queryType: 'user.get_statistics';
  payload: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
  };
}

/**
 * Union type of all queries
 */
export type AllQueries =
  | GetUserQuery
  | GetUserProfileQuery
  | ListVoiceModelsQuery
  | GetVoiceModelQuery
  | ListFaceModelsQuery
  | GetFaceModelQuery
  | ListDocumentsQuery
  | GetDocumentQuery
  | GetConversationSessionQuery
  | ListConversationSessionsQuery
  | GetConversationHistoryQuery
  | GetUserStatisticsQuery;

export type QueryType = AllQueries['queryType'];
