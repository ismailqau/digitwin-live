export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type SourceType = 'document' | 'faq' | 'conversation';

export interface KnowledgeDocument {
  id: string;
  userId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
  processedAt?: Date;
  textContent: string;
  chunkCount: number;
  title?: string;
  author?: string;
  sourceUrl?: string;
  tags: string[];
  status: DocumentStatus;
  errorMessage?: string;
  storagePath: string;
  vectorIds: string[];
}

export interface TextChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  metadata: Record<string, unknown>;
}

export interface VectorMetadata {
  userId: string;
  documentId: string;
  chunkIndex: number;
  sourceType: SourceType;
  content: string;
  timestamp: number;
  title?: string;
  url?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  content: string;
}
