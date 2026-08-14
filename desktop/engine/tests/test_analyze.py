#!/usr/bin/env python3
import sys
import os
import tempfile

# Ensure analyze module can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from analyze import analyze_source, analyze_code, rewrite_code

def test_multiplication_by_one():
    code = """
def test_fn(x):
    y = x * 1
    z = x * 1.0
    return y + z
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 2
    assert result["causal_luminance"] == 0.0
    assert any("Identity Multiplication (x * 1)" in f["title"] for f in result["findings"])
    assert any("Assignment target: y" in f["provenance"] for f in result["findings"])

def test_multiplication_by_one_reversed():
    code = """
def test_fn(x):
    y = 1 * x
    z = 1.0 * x
    return y + z
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 2
    assert result["causal_luminance"] == 0.0
    assert any("Identity Multiplication (1 * x)" in f["title"] for f in result["findings"])

def test_addition_by_zero():
    code = """
def test_fn(x):
    y = x + 0
    z = x + 0.0
    return y + z
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 2
    assert result["causal_luminance"] == 0.0
    assert any("Identity Addition (x + 0)" in f["title"] for f in result["findings"])
    assert any("Assignment target: y" in f["provenance"] for f in result["findings"])

def test_addition_by_zero_reversed():
    code = """
def test_fn(x):
    y = 0 + x
    z = 0.0 + x
    return y + z
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 2
    assert result["causal_luminance"] == 0.0
    assert any("Identity Addition (0 + x)" in f["title"] for f in result["findings"])

def test_subtraction_by_zero():
    code = """
def test_fn(x):
    y = x - 0
    z = x - 0.0
    return y + z
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 2
    assert result["causal_luminance"] == 0.0
    assert any("Identity Subtraction (x - 0)" in f["title"] for f in result["findings"])

def test_division_by_one():
    code = """
def test_fn(x):
    y = x / 1
    z = x / 1.0
    return y + z
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 2
    assert result["causal_luminance"] == 0.0
    assert any("Identity Division (x / 1)" in f["title"] for f in result["findings"])

def test_meaningful_math_not_flagged():
    code = """
def meaningful_fn(x):
    a = x * 2
    b = x + 1
    c = 0 - x  # Sign inversion, not identity
    d = 1 / x  # Reciprocal, not identity
    e = x - 5
    return a + b + c + d + e
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 0
    assert result["causal_luminance"] == 1.0
    assert len(result["findings"]) == 0

def test_provenance_metadata():
    code = "subtotal = subtotal * 1\n"
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 1
    finding = result["findings"][0]
    assert finding["provenance"] == [
        "Assignment target: subtotal",
        "Identity operation: multiplication by 1",
        "Expression is semantically equivalent to original value"
    ]

def test_provenance_chain_sequential_example():
    code = """def calc_order(items, discount):
    subtotal = sum(item.price for item in items)
    subtotal = subtotal * 1
    final_total = subtotal - discount
    return max(0, final_total)
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 1
    finding = result["findings"][0]

    chain = finding["provenance_chain"]
    assert len(chain) == 4
    assert finding["causal_path_length"] == 4
    assert finding["return_sink_line"] == 5

    assert chain[0]["type"] == "definition"
    assert chain[0]["line"] == 2
    assert "subtotal = sum" in chain[0]["code"]

    assert chain[1]["type"] == "ghost_operation"
    assert chain[1]["line"] == 3
    assert "subtotal = subtotal * 1" in chain[1]["code"]

    assert chain[2]["type"] == "use"
    assert chain[2]["line"] == 4
    assert "final_total = subtotal - discount" in chain[2]["code"]

    assert chain[3]["type"] == "return_sink"
    assert chain[3]["line"] == 5
    assert "return max(0, final_total)" in chain[3]["code"]

def test_provenance_chain_parameter_definition():
    code = """def apply_rate(amount):
    amount = amount + 0
    total = amount * 1.05
    return total
"""
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 1
    finding = result["findings"][0]

    chain = finding["provenance_chain"]
    assert chain[0]["type"] == "definition"
    assert chain[0]["line"] == 1
    assert "def apply_rate(amount):" in chain[0]["code"]

    assert chain[1]["type"] == "ghost_operation"
    assert chain[1]["line"] == 2

    assert chain[2]["type"] == "use"
    assert chain[2]["line"] == 3
    assert "total = amount * 1.05" in chain[2]["code"]

    assert chain[3]["type"] == "return_sink"
    assert chain[3]["line"] == 4

def test_rewrite_output():
    code = """def calc(price):
    price = price * 1
    price = price + 0
    return price
"""
    with tempfile.NamedTemporaryFile("w+", suffix=".py", delete=False) as tf:
        tf.write(code)
        tf_path = tf.name

    try:
        res = rewrite_code(tf_path)
        assert res["ghost_count_before"] == 2
        assert res["ghost_count_after"] == 0
        assert res["causal_luminance_after"] == 1.0
        assert len(res["changed_lines"]) == 2
    finally:
        if os.path.exists(tf_path):
            os.remove(tf_path)

def test_syntax_error_handling():
    invalid_code = "def broken_syntax(:\n    pass\n"
    result = analyze_source(invalid_code)
    assert "error" in result
    assert result["ghost_lines_count"] == 0
    assert result["findings"] == []

def test_verify_equivalence_identical():
    from verify_equivalence import verify_equivalence
    code = "x = 42\nprint('result:', x)\n"
    with tempfile.NamedTemporaryFile("w+", suffix=".py", delete=False) as tf:
        tf.write(code)
        tf_path = tf.name

    try:
        res = verify_equivalence(tf_path, code)
        assert res["verified"] is True
        assert res["status"] == "BEHAVIORAL_EQUIVALENCE_CONFIRMED"
        assert res["outputs_match"] is True
        assert res["original"]["exit_code"] == 0
        assert res["transformed"]["exit_code"] == 0
    finally:
        if os.path.exists(tf_path):
            os.remove(tf_path)

def test_verify_equivalence_divergent():
    from verify_equivalence import verify_equivalence
    orig_code = "print('OK')\n"
    divergent_code = "raise RuntimeError('Failure')\n"
    with tempfile.NamedTemporaryFile("w+", suffix=".py", delete=False) as tf:
        tf.write(orig_code)
        tf_path = tf.name

    try:
        res = verify_equivalence(tf_path, divergent_code)
        assert res["verified"] is False
        assert res["status"] == "BEHAVIORAL_DIVERGENCE_DETECTED"
        assert res["outputs_match"] is False
    finally:
        if os.path.exists(tf_path):
            os.remove(tf_path)

def test_self_assignment_detected():
    code = "x = 10\nx = x\nprint(x)\n"
    result = analyze_source(code)
    assert result["ghost_lines_count"] == 1
    finding = result["findings"][0]
    assert finding["line"] == 2
    assert finding["code"] == "x = x"
    assert "Vacuous Self-Assignment" in finding["title"]

if __name__ == "__main__":
    test_funcs = [v for k, v in list(globals().items()) if k.startswith("test_") and callable(v)]
    passed = 0
    failed = 0
    print(f"Running {len(test_funcs)} AST engine & provenance tests...\n")
    for fn in test_funcs:
        try:
            fn()
            print(f"  [PASS] {fn.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  [FAIL] {fn.__name__} - Assertion failed: {e}")
            failed += 1
        except Exception as e:
            print(f"  [ERROR] {fn.__name__} - {e}")
            failed += 1

    print(f"\nResults: {passed} passed, {failed} failed.")
    if failed > 0:
        sys.exit(1)
