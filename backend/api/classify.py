"""Keyword classifier for spoken/typed incident reports (English + Hindi, Devanagari and romanised)."""
import re

# Checked in this order; ties go to the earlier category.
KEYWORDS = {
    "person_in_zone": {
        "en": ["person", "people", "man", "woman", "worker", "someone", "somebody", "pedestrian", "child", "in the zone", "walked", "walking"],
        "hi": ["आदमी", "व्यक्ति", "कोई", "मजदूर", "मज़दूर", "लोग", "इंसान", "बच्चा", "aadmi", "admi", "koi", "mazdoor", "insaan"],
    },
    "near_miss": {
        "en": ["near miss", "almost", "nearly", "close call", "just missed", "narrowly"],
        "hi": ["बाल बाल", "बाल-बाल", "लगभग", "टक्कर होते", "bal bal", "baal baal", "lagbhag"],
    },
    "machine_issue": {
        "en": ["leak", "oil", "brake", "engine", "noise", "smoke", "hydraulic", "broken", "fault", "warning light", "tyre", "tire", "track", "overheat"],
        "hi": ["रिसाव", "तेल", "ब्रेक", "इंजन", "आवाज़", "आवाज", "धुआं", "धुआँ", "खराब", "ख़राब", "खराबी", "tel", "kharab", "kharaab", "dhuan", "awaaz", "awaz"],
    },
}


def _hits(text, words):
    found = []
    for w in words:
        if w.isascii():
            if re.search(r"\b" + re.escape(w) + r"\b", text):
                found.append(w)
        elif w in text:
            found.append(w)
    return found


def classify(text):
    """Return {"category", "matched"}; category is "other" when nothing matches."""
    text = (text or "").lower()
    best, best_hits = "other", []
    for category, langs in KEYWORDS.items():
        hits = _hits(text, langs["en"] + langs["hi"])
        if len(hits) > len(best_hits):
            best, best_hits = category, hits
    return {"category": best, "matched": best_hits}
