"""Translation provider for extended language support.

Qwen3-TTS natively supports: zh, en, ja, ko, de, fr, ru, pt, es, it.
Extended languages (ur, ar, hi, zh) are translated to English before synthesis,
then the synthesized voice carries the target language's prosody via instruction.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Languages natively supported by Qwen3-TTS
NATIVE_LANGUAGES = {"zh", "en", "ja", "ko", "de", "fr", "ru", "pt", "es", "it"}

# Extended languages: map to a bridge language for translation
EXTENDED_LANGUAGE_BRIDGE: dict[str, str] = {
    "ur": "en",  # Urdu → English
    "ar": "en",  # Arabic → English
    "hi": "en",  # Hindi → English
}

# Human-readable names for all supported languages
LANGUAGE_DISPLAY_NAMES: dict[str, str] = {
    "zh": "Chinese",
    "en": "English",
    "ja": "Japanese",
    "ko": "Korean",
    "de": "German",
    "fr": "French",
    "ru": "Russian",
    "pt": "Portuguese",
    "es": "Spanish",
    "it": "Italian",
    "ur": "Urdu",
    "ar": "Arabic",
    "hi": "Hindi",
}

# Argos Translate language code mapping (uses full names or ISO codes)
ARGOS_LANG_MAP: dict[str, str] = {
    "ur": "ur",
    "ar": "ar",
    "hi": "hi",
    "en": "en",
    "zh": "zh",
}


class TranslationProvider:
    """Translates text from extended languages to a Qwen3-TTS native language."""

    def __init__(self) -> None:
        self._argos_available: Optional[bool] = None
        self._deep_translator_available: Optional[bool] = None

    def is_native(self, lang_code: str) -> bool:
        return lang_code in NATIVE_LANGUAGES

    def needs_translation(self, lang_code: str) -> bool:
        return lang_code in EXTENDED_LANGUAGE_BRIDGE

    def get_bridge_language(self, lang_code: str) -> str:
        """Return the native Qwen3-TTS language to use as synthesis target."""
        return EXTENDED_LANGUAGE_BRIDGE.get(lang_code, "en")

    def translate(self, text: str, source_lang: str, target_lang: str = "en") -> str:
        """Translate text from source_lang to target_lang.

        Tries argos-translate first, falls back to deep-translator (Google).
        Returns original text if translation fails.
        """
        if source_lang == target_lang:
            return text

        # Try argos-translate (offline)
        translated = self._try_argos(text, source_lang, target_lang)
        if translated:
            return translated

        # Fall back to deep-translator (online, Google Translate)
        translated = self._try_deep_translator(text, source_lang, target_lang)
        if translated:
            return translated

        logger.warning(
            "Translation unavailable for %s→%s, using original text", source_lang, target_lang
        )
        return text

    def _try_argos(self, text: str, source: str, target: str) -> Optional[str]:
        """Attempt translation via argos-translate."""
        if self._argos_available is False:
            return None
        try:
            import argostranslate.package
            import argostranslate.translate

            installed = argostranslate.translate.get_installed_languages()
            src_lang = next((l for l in installed if l.code == source), None)
            tgt_lang = next((l for l in installed if l.code == target), None)

            if src_lang is None or tgt_lang is None:
                # Try to install the package automatically
                self._install_argos_package(source, target)
                installed = argostranslate.translate.get_installed_languages()
                src_lang = next((l for l in installed if l.code == source), None)
                tgt_lang = next((l for l in installed if l.code == target), None)

            if src_lang and tgt_lang:
                translation = src_lang.get_translation(tgt_lang)
                if translation:
                    self._argos_available = True
                    return translation.translate(text)

        except ImportError:
            self._argos_available = False
            logger.info("argos-translate not installed, skipping")
        except Exception as e:
            logger.warning("argos-translate failed: %s", e)

        return None

    @staticmethod
    def _install_argos_package(source: str, target: str) -> None:
        """Download and install argos-translate language package."""
        try:
            import argostranslate.package

            argostranslate.package.update_package_index()
            available = argostranslate.package.get_available_packages()
            pkg = next(
                (p for p in available if p.from_code == source and p.to_code == target),
                None,
            )
            if pkg:
                logger.info("Installing argos package: %s→%s", source, target)
                argostranslate.package.install_from_path(pkg.download())
        except Exception as e:
            logger.warning("Failed to install argos package %s→%s: %s", source, target, e)

    def _try_deep_translator(self, text: str, source: str, target: str) -> Optional[str]:
        """Attempt translation via deep-translator (Google Translate)."""
        if self._deep_translator_available is False:
            return None
        try:
            from deep_translator import GoogleTranslator

            result = GoogleTranslator(source=source, target=target).translate(text)
            self._deep_translator_available = True
            return result
        except ImportError:
            self._deep_translator_available = False
            logger.info("deep-translator not installed, skipping")
        except Exception as e:
            logger.warning("deep-translator failed: %s", e)

        return None


# Singleton
translation_provider = TranslationProvider()
