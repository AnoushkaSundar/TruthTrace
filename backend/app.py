import os
import json
import base64
import random
import time
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from groq import Groq
from dotenv import load_dotenv
from prompt import TRUTHTRACE_SYSTEM_PROMPT

# Path to the frontend folder (sibling of backend/)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')

load_dotenv(override=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["30 per minute"],
    storage_uri="memory://"
)

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_VISION_MODEL = os.environ.get("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
MAX_RETRIES = 2
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


def call_groq_with_retry(claim: str, max_retries: int = MAX_RETRIES):
    """Call Groq API with automatic retry on failure."""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            logger.info(f"Groq API call attempt {attempt + 1}/{max_retries + 1}")
            completion = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": TRUTHTRACE_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Investigate this claim:\n\n\"{claim}\""}
                ],
                temperature=0.2,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            raw_content = completion.choices[0].message.content
            logger.info("Groq API call succeeded")
            return raw_content
        except Exception as e:
            last_error = e
            logger.warning(f"Groq API attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries:
                time.sleep(1.5 * (attempt + 1))

    raise last_error


def validate_verdict(data: dict) -> dict:
    """Ensure all required fields are present with sensible defaults."""
    defaults = {
        "case_id": f"TT-{random.randint(1000, 9999)}",
        "verdict": "UNVERIFIABLE",
        "confidence": 50,
        "danger_level": "MEDIUM",
        "manipulation_score": 5.0,
        "summary": "Analysis could not be completed fully.",
        "red_flags": [],
        "logical_fallacies": [],
        "decomposition": {
            "core_assertion": "",
            "verifiable_facts": [],
            "implicit_assumptions": [],
            "missing_context": [],
            "emotional_triggers": []
        },
        "evidence": {
            "supporting": [],
            "contradicting": []
        },
        "motive_analysis": "Unable to determine motive at this time.",
        "reasoning": "The AI was unable to fully analyze this claim.",
        "investigators_note": "Proceed with caution.",
        "recommendation": "Verify before sharing",
        "social_media_signals": {
            "is_social_media_post": False,
            "platform_detected": "Unknown",
            "engagement_bait": False,
            "virality_tactics": [],
            "credibility_assessment": ""
        }
    }

    for key, default_value in defaults.items():
        if key not in data or data[key] is None:
            data[key] = default_value

    # Clamp numeric values
    data["confidence"] = max(0, min(100, int(data.get("confidence", 50))))
    data["manipulation_score"] = max(0.0, min(10.0, float(data.get("manipulation_score", 5.0))))

    valid_verdicts = ["TRUE", "MOSTLY TRUE", "MISLEADING", "MOSTLY FALSE", "FALSE", "UNVERIFIABLE"]
    if data.get("verdict") not in valid_verdicts:
        data["verdict"] = "UNVERIFIABLE"

    valid_danger = ["LOW", "MEDIUM", "HIGH"]
    if data.get("danger_level") not in valid_danger:
        data["danger_level"] = "MEDIUM"

    valid_recs = ["Safe to share", "Share with caution", "Do not share", "Verify before sharing"]
    if data.get("recommendation") not in valid_recs:
        data["recommendation"] = "Verify before sharing"

    return data


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": GROQ_MODEL}), 200


@app.route("/api/investigate", methods=["POST"])
@limiter.limit("30 per minute")
def investigate():
    """Main investigation endpoint."""
    try:
        body = request.get_json()
        if not body or "claim" not in body:
            return jsonify({"error": "Missing 'claim' field in request body."}), 400

        claim = str(body["claim"]).strip()

        if len(claim) < 10:
            return jsonify({"error": "Claim must be at least 10 characters long."}), 400

        if len(claim) > 2000:
            return jsonify({"error": "Claim must not exceed 2000 characters."}), 400

        raw_response = call_groq_with_retry(claim)

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Groq JSON response: {e}")
            logger.error(f"Raw response: {raw_response[:500]}")
            return jsonify({"error": "AI returned an invalid response. Please try again."}), 502

        verdict_data = validate_verdict(parsed)
        return jsonify(verdict_data), 200

    except Exception as e:
        logger.error(f"Investigation failed: {str(e)}")
        return jsonify({
            "error": "Investigation failed. Please check your connection and try again.",
            "detail": str(e)
        }), 500


@app.route("/api/investigate-image", methods=["POST"])
@limiter.limit("10 per minute")
def investigate_image():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided."}), 400

    file = request.files["image"]
    if not file.filename:
        return jsonify({"error": "No file selected."}), 400

    content_type = (file.content_type or "").split(";")[0].strip()
    if content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Unsupported file type. Please upload JPEG, PNG, GIF, or WebP."}), 400

    image_data = file.read()
    if len(image_data) > MAX_IMAGE_BYTES:
        return jsonify({"error": "Image too large. Maximum size is 10 MB."}), 400

    encoded = base64.b64encode(image_data).decode("utf-8")

    try:
        completion = groq_client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=[
                {"role": "system", "content": TRUTHTRACE_SYSTEM_PROMPT},
                {"role": "user", "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{content_type};base64,{encoded}"}
                    },
                    {
                        "type": "text",
                        "text": (
                            "Carefully examine this image. "
                            "Extract every piece of visible text — headlines, captions, post body, overlaid text, watermarks, comments. "
                            "Identify what kind of content this is (tweet, Facebook post, news article screenshot, WhatsApp forward, meme, etc.). "
                            "Then perform a full TruthTrace forensic investigation on all claims, scenarios, and narratives present in the image. "
                            "Return your complete investigation as a JSON object following the required structure exactly."
                        )
                    }
                ]}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=3000,
        )

        raw_response = completion.choices[0].message.content
        logger.info("Vision API call succeeded")

        try:
            parsed = json.loads(raw_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse vision model JSON: {e}")
            return jsonify({"error": "AI returned an invalid response. Please try again."}), 502

        verdict_data = validate_verdict(parsed)
        return jsonify(verdict_data), 200

    except Exception as e:
        logger.error(f"Image investigation failed: {str(e)}")
        return jsonify({
            "error": "Failed to analyze image. Please try again.",
            "detail": str(e)
        }), 500


@app.route("/", methods=["GET"])
def serve_index():
    return send_from_directory(os.path.abspath(FRONTEND_DIR), "index.html")


@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    return send_from_directory(os.path.abspath(FRONTEND_DIR), filename)


@app.errorhandler(429)
def rate_limit_handler(e):
    return jsonify({"error": "Too many requests. Please wait a moment before trying again."}), 429


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV", "development") == "development"
    logger.info(f"TruthTrace backend starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
