from types import SimpleNamespace

from utils.gemini_response import extract_text_parts


def test_extract_text_parts_ignores_thought_signature_metadata():
    response = SimpleNamespace(
        candidates=[
            SimpleNamespace(
                content=SimpleNamespace(
                    parts=[
                        SimpleNamespace(text="hello", thought_signature="signature"),
                        SimpleNamespace(text=" world"),
                    ]
                )
            )
        ]
    )

    assert extract_text_parts(response) == "hello world"


def test_extract_text_parts_returns_empty_without_text():
    response = SimpleNamespace(
        candidates=[
            SimpleNamespace(
                content=SimpleNamespace(
                    parts=[SimpleNamespace(thought_signature="signature")]
                )
            )
        ]
    )

    assert extract_text_parts(response) == ""
