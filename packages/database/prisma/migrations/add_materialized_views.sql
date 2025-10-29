-- Materialized Views for CQRS Read Models
-- These views optimize read operations by pre-computing common queries

-- User Profile View
-- Aggregates user data with their active models and statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_profile_view AS
SELECT 
  u.id,
  u.email,
  u.name,
  u.created_at,
  u.updated_at,
  u.personality_traits,
  u.speaking_style,
  u.subscription_tier,
  u.conversation_minutes_used,
  -- Active voice model
  (
    SELECT json_build_object(
      'id', vm.id,
      'provider', vm.provider,
      'quality_score', vm.quality_score,
      'created_at', vm.created_at
    )
    FROM voice_models vm
    WHERE vm.user_id = u.id AND vm.is_active = true AND vm.deleted_at IS NULL
    LIMIT 1
  ) as active_voice_model,
  -- Active face model
  (
    SELECT json_build_object(
      'id', fm.id,
      'quality_score', fm.quality_score,
      'resolution', json_build_object('width', fm.resolution_width, 'height', fm.resolution_height),
      'created_at', fm.created_at
    )
    FROM face_models fm
    WHERE fm.user_id = u.id AND fm.is_active = true AND fm.deleted_at IS NULL
    LIMIT 1
  ) as active_face_model,
  -- Document count
  (
    SELECT COUNT(*)
    FROM knowledge_documents kd
    WHERE kd.user_id = u.id AND kd.deleted_at IS NULL
  ) as document_count,
  -- Conversation count (last 30 days)
  (
    SELECT COUNT(*)
    FROM conversation_sessions cs
    WHERE cs.user_id = u.id 
      AND cs.started_at >= NOW() - INTERVAL '30 days'
      AND cs.deleted_at IS NULL
  ) as recent_conversation_count
FROM users u
WHERE u.deleted_at IS NULL;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_view_id ON user_profile_view(id);

-- Conversation Session Summary View
-- Aggregates conversation sessions with turn counts and metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS conversation_session_summary_view AS
SELECT 
  cs.id,
  cs.user_id,
  cs.started_at,
  cs.ended_at,
  cs.duration_seconds,
  cs.state,
  cs.llm_provider,
  cs.tts_provider,
  cs.voice_model_id,
  cs.face_model_id,
  -- Turn statistics
  (
    SELECT COUNT(*)
    FROM conversation_turns ct
    WHERE ct.session_id = cs.id
  ) as turn_count,
  (
    SELECT AVG(ct.total_latency_ms)
    FROM conversation_turns ct
    WHERE ct.session_id = cs.id
  ) as avg_latency_ms,
  (
    SELECT SUM(ct.total_cost)
    FROM conversation_turns ct
    WHERE ct.session_id = cs.id
  ) as total_cost,
  -- First and last turn timestamps
  (
    SELECT MIN(ct.timestamp)
    FROM conversation_turns ct
    WHERE ct.session_id = cs.id
  ) as first_turn_at,
  (
    SELECT MAX(ct.timestamp)
    FROM conversation_turns ct
    WHERE ct.session_id = cs.id
  ) as last_turn_at
FROM conversation_sessions cs
WHERE cs.deleted_at IS NULL;

-- Create indexes for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_summary_view_id ON conversation_session_summary_view(id);
CREATE INDEX IF NOT EXISTS idx_conversation_summary_view_user_id ON conversation_session_summary_view(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summary_view_started_at ON conversation_session_summary_view(started_at DESC);

-- Document Summary View
-- Aggregates document data with processing status
CREATE MATERIALIZED VIEW IF NOT EXISTS document_summary_view AS
SELECT 
  kd.id,
  kd.user_id,
  kd.filename,
  kd.content_type,
  kd.size_bytes,
  kd.uploaded_at,
  kd.processed_at,
  kd.status,
  kd.chunk_count,
  kd.title,
  kd.tags,
  -- Processing duration
  CASE 
    WHEN kd.processed_at IS NOT NULL AND kd.uploaded_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (kd.processed_at - kd.uploaded_at)) * 1000
    ELSE NULL
  END as processing_duration_ms
FROM knowledge_documents kd
WHERE kd.deleted_at IS NULL;

-- Create indexes for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_summary_view_id ON document_summary_view(id);
CREATE INDEX IF NOT EXISTS idx_document_summary_view_user_id ON document_summary_view(user_id);
CREATE INDEX IF NOT EXISTS idx_document_summary_view_status ON document_summary_view(status);
CREATE INDEX IF NOT EXISTS idx_document_summary_view_uploaded_at ON document_summary_view(uploaded_at DESC);

-- User Statistics View
-- Aggregates user usage statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_statistics_view AS
SELECT 
  u.id as user_id,
  -- Conversation statistics
  COUNT(DISTINCT cs.id) as total_conversations,
  COALESCE(SUM(cs.duration_seconds), 0) as total_conversation_seconds,
  COALESCE(AVG(cs.duration_seconds), 0) as avg_conversation_seconds,
  -- Turn statistics
  (
    SELECT COUNT(*)
    FROM conversation_turns ct
    JOIN conversation_sessions cs2 ON ct.session_id = cs2.id
    WHERE cs2.user_id = u.id AND cs2.deleted_at IS NULL
  ) as total_turns,
  -- Cost statistics
  COALESCE(SUM(
    (
      SELECT SUM(ct.total_cost)
      FROM conversation_turns ct
      WHERE ct.session_id = cs.id
    )
  ), 0) as total_cost,
  -- Document statistics
  (
    SELECT COUNT(*)
    FROM knowledge_documents kd
    WHERE kd.user_id = u.id AND kd.deleted_at IS NULL
  ) as total_documents,
  (
    SELECT COUNT(*)
    FROM knowledge_documents kd
    WHERE kd.user_id = u.id 
      AND kd.status = 'completed' 
      AND kd.deleted_at IS NULL
  ) as processed_documents,
  -- Model statistics
  (
    SELECT COUNT(*)
    FROM voice_models vm
    WHERE vm.user_id = u.id AND vm.deleted_at IS NULL
  ) as total_voice_models,
  (
    SELECT COUNT(*)
    FROM face_models fm
    WHERE fm.user_id = u.id AND fm.deleted_at IS NULL
  ) as total_face_models,
  -- Last activity
  GREATEST(
    u.updated_at,
    (SELECT MAX(cs.started_at) FROM conversation_sessions cs WHERE cs.user_id = u.id),
    (SELECT MAX(kd.uploaded_at) FROM knowledge_documents kd WHERE kd.user_id = u.id)
  ) as last_activity_at
FROM users u
LEFT JOIN conversation_sessions cs ON cs.user_id = u.id AND cs.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_statistics_view_user_id ON user_statistics_view(user_id);

-- Voice Model Summary View
CREATE MATERIALIZED VIEW IF NOT EXISTS voice_model_summary_view AS
SELECT 
  vm.id,
  vm.user_id,
  vm.provider,
  vm.model_path,
  vm.sample_rate,
  vm.quality_score,
  vm.is_active,
  vm.created_at,
  -- Usage count (conversations using this model)
  (
    SELECT COUNT(*)
    FROM conversation_sessions cs
    WHERE cs.voice_model_id = vm.id AND cs.deleted_at IS NULL
  ) as usage_count,
  -- Last used
  (
    SELECT MAX(cs.started_at)
    FROM conversation_sessions cs
    WHERE cs.voice_model_id = vm.id AND cs.deleted_at IS NULL
  ) as last_used_at
FROM voice_models vm
WHERE vm.deleted_at IS NULL;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_model_summary_view_id ON voice_model_summary_view(id);
CREATE INDEX IF NOT EXISTS idx_voice_model_summary_view_user_id ON voice_model_summary_view(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_model_summary_view_is_active ON voice_model_summary_view(is_active);

-- Face Model Summary View
CREATE MATERIALIZED VIEW IF NOT EXISTS face_model_summary_view AS
SELECT 
  fm.id,
  fm.user_id,
  fm.model_path,
  fm.resolution_width,
  fm.resolution_height,
  fm.quality_score,
  fm.keypoint_count,
  fm.is_active,
  fm.created_at,
  -- Usage count
  (
    SELECT COUNT(*)
    FROM conversation_sessions cs
    WHERE cs.face_model_id = fm.id AND cs.deleted_at IS NULL
  ) as usage_count,
  -- Last used
  (
    SELECT MAX(cs.started_at)
    FROM conversation_sessions cs
    WHERE cs.face_model_id = fm.id AND cs.deleted_at IS NULL
  ) as last_used_at
FROM face_models fm
WHERE fm.deleted_at IS NULL;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_face_model_summary_view_id ON face_model_summary_view(id);
CREATE INDEX IF NOT EXISTS idx_face_model_summary_view_user_id ON face_model_summary_view(user_id);
CREATE INDEX IF NOT EXISTS idx_face_model_summary_view_is_active ON face_model_summary_view(is_active);

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_profile_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_session_summary_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY document_summary_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_statistics_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY voice_model_summary_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY face_model_summary_view;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to refresh views (requires pg_cron extension)
-- Uncomment if pg_cron is available
-- SELECT cron.schedule('refresh-materialized-views', '*/5 * * * *', 'SELECT refresh_all_materialized_views()');
