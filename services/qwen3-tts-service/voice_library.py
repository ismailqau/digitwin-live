"""Voice library — persistent store for cloned voices.

Cloned voices are stored as base64 audio samples on disk so they survive
restarts. Each entry has a unique ID, a display name, and the original
reference audio used for cloning.
"""

import json
import logging
import os
import uuid
from dataclasses import asdict, dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

LIBRARY_DIR = os.getenv("VOICE_LIBRARY_DIR", "/app/voice_library")
LIBRARY_INDEX = os.path.join(LIBRARY_DIR, "index.json")


@dataclass
class VoiceEntry:
    id: str
    name: str
    description: str
    ref_audio_b64: str          # base64 WAV/MP3/FLAC reference audio
    ref_text: Optional[str]     # optional transcript for higher-quality cloning
    created_at: str
    language_hint: str = "en"   # language of the reference audio


class VoiceLibrary:
    """In-memory voice library backed by a JSON index on disk."""

    def __init__(self) -> None:
        self._voices: dict[str, VoiceEntry] = {}
        self._load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load(self) -> None:
        os.makedirs(LIBRARY_DIR, exist_ok=True)
        if not os.path.exists(LIBRARY_INDEX):
            return
        try:
            with open(LIBRARY_INDEX, "r") as f:
                data = json.load(f)
            for entry in data:
                v = VoiceEntry(**entry)
                self._voices[v.id] = v
            logger.info("Loaded %d voices from library", len(self._voices))
        except Exception as e:
            logger.warning("Failed to load voice library: %s", e)

    def _save(self) -> None:
        try:
            os.makedirs(LIBRARY_DIR, exist_ok=True)
            with open(LIBRARY_INDEX, "w") as f:
                json.dump([asdict(v) for v in self._voices.values()], f, indent=2)
        except Exception as e:
            logger.warning("Failed to save voice library: %s", e)

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def add_voice(
        self,
        name: str,
        ref_audio_b64: str,
        description: str = "",
        ref_text: Optional[str] = None,
        language_hint: str = "en",
    ) -> VoiceEntry:
        from datetime import datetime, timezone

        voice_id = str(uuid.uuid4())
        entry = VoiceEntry(
            id=voice_id,
            name=name,
            description=description,
            ref_audio_b64=ref_audio_b64,
            ref_text=ref_text,
            created_at=datetime.now(timezone.utc).isoformat(),
            language_hint=language_hint,
        )
        self._voices[voice_id] = entry
        self._save()
        logger.info("Added voice '%s' (id=%s)", name, voice_id)
        return entry

    def get_voice(self, voice_id: str) -> Optional[VoiceEntry]:
        return self._voices.get(voice_id)

    def list_voices(self) -> list[VoiceEntry]:
        return list(self._voices.values())

    def delete_voice(self, voice_id: str) -> bool:
        if voice_id not in self._voices:
            return False
        del self._voices[voice_id]
        self._save()
        logger.info("Deleted voice id=%s", voice_id)
        return True

    def update_voice(
        self,
        voice_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Optional[VoiceEntry]:
        entry = self._voices.get(voice_id)
        if not entry:
            return None
        if name is not None:
            entry.name = name
        if description is not None:
            entry.description = description
        self._save()
        return entry


# Singleton
voice_library = VoiceLibrary()
