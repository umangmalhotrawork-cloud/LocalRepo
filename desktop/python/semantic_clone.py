import ast

def is_const_val(node, val):
    if isinstance(node, ast.Constant):
        return node.value == val
    return False

def ast_to_repr(node):
    if isinstance(node, ast.Name):
        return f"Name({node.id})"
    elif isinstance(node, ast.Constant):
        return f"Const({node.value})"
    elif isinstance(node, ast.Attribute):
        return f"Attr({ast_to_repr(node.value)}.{node.attr})"
    elif isinstance(node, ast.BinOp):
        return f"BinOp({ast_to_repr(node.left)},{type(node.op).__name__},{ast_to_repr(node.right)})"
    elif isinstance(node, ast.UnaryOp):
        return f"UnaryOp({type(node.op).__name__},{ast_to_repr(node.operand)})"
    elif isinstance(node, ast.BoolOp):
        vals = ",".join(ast_to_repr(v) for v in node.values)
        return f"BoolOp({type(node.op).__name__},[{vals}])"
    elif isinstance(node, ast.Call):
        func_repr = ast_to_repr(node.func)
        args_repr = ",".join(ast_to_repr(a) for a in node.args)
        return f"Call({func_repr},[{args_repr}])"
    return type(node).__name__

class SemanticNormalizer(ast.NodeTransformer):
    def visit_AugAssign(self, node):
        self.generic_visit(node)
        # Convert AugAssign(target, op, value) to Assign([target], BinOp(target, op, value))
        bin_op = ast.BinOp(left=node.target, op=node.op, right=node.value)
        new_node = ast.Assign(targets=[node.target], value=bin_op)
        return self.visit(new_node)

    def visit_BinOp(self, node):
        left = self.visit(node.left)
        right = self.visit(node.right)
        op = node.op

        # 1. Identity Elimination for Add/Sub
        if isinstance(op, (ast.Add, ast.Sub)):
            if is_const_val(right, 0):
                return left
            if isinstance(op, ast.Add) and is_const_val(left, 0):
                return right

        # 2. Identity Elimination for Mult/Div
        if isinstance(op, ast.Mult):
            if is_const_val(right, 1):
                return left
            if is_const_val(left, 1):
                return right
            if is_const_val(right, 0) or is_const_val(left, 0):
                return ast.Constant(value=0)

        if isinstance(op, (ast.Div, ast.FloorDiv)):
            if is_const_val(right, 1):
                return left

        # 3. Simple Constant Folding
        if isinstance(left, ast.Constant) and isinstance(right, ast.Constant):
            lv, rv = left.value, right.value
            if isinstance(lv, (int, float)) and isinstance(rv, (int, float)):
                try:
                    if isinstance(op, ast.Add):
                        return ast.Constant(value=lv + rv)
                    elif isinstance(op, ast.Sub):
                        return ast.Constant(value=lv - rv)
                    elif isinstance(op, ast.Mult):
                        return ast.Constant(value=lv * rv)
                    elif isinstance(op, ast.Div) and rv != 0:
                        return ast.Constant(value=lv / rv)
                except Exception:
                    pass

        # 4. Commutative Normalization for Add, Mult, BitOr, BitAnd, BitXor
        if isinstance(op, (ast.Add, ast.Mult, ast.BitOr, ast.BitAnd, ast.BitXor)):
            l_repr = ast_to_repr(left)
            r_repr = ast_to_repr(right)
            if r_repr < l_repr:
                left, right = right, left

        return ast.BinOp(left=left, op=op, right=right)

    def visit_BoolOp(self, node):
        values = [self.visit(v) for v in node.values]
        op = node.op

        # Identity Elimination for And / Or
        new_values = []
        for v in values:
            if isinstance(op, ast.And):
                if is_const_val(v, True):
                    continue  # flag and True -> flag
                if is_const_val(v, False):
                    return ast.Constant(value=False)
            elif isinstance(op, ast.Or):
                if is_const_val(v, False):
                    continue  # flag or False -> flag
                if is_const_val(v, True):
                    return ast.Constant(value=True)
            new_values.append(v)

        if not new_values:
            return ast.Constant(value=True if isinstance(op, ast.And) else False)
        if len(new_values) == 1:
            return new_values[0]

        # Commutative Sorting for And / Or
        new_values.sort(key=lambda v: ast_to_repr(v))
        return ast.BoolOp(op=op, values=new_values)

class CanonicalIdentifierRenamer(ast.NodeTransformer):
    def __init__(self):
        self.var_map = {}
        self.func_map = {}
        self.attr_map = {}
        self.var_counter = 1
        self.func_counter = 1
        self.attr_counter = 1

    def visit_Name(self, node):
        if node.id not in self.var_map:
            self.var_map[node.id] = f"VAR_{self.var_counter}"
            self.var_counter += 1
        return ast.Name(id=self.var_map[node.id], ctx=node.ctx)

    def visit_Attribute(self, node):
        value = self.visit(node.value)
        if node.attr not in self.attr_map:
            self.attr_map[node.attr] = f"ATTR_{self.attr_counter}"
            self.attr_counter += 1
        return ast.Attribute(value=value, attr=self.attr_map[node.attr], ctx=node.ctx)

    def visit_Constant(self, node):
        # Keep numeric 0/1 constants or boolean constants if needed for identity check,
        # otherwise normalize numbers/strings to CONST
        if isinstance(node.value, bool):
            return node
        if isinstance(node.value, (int, float)):
            return node
        return ast.Constant(value="CONST")

def normalize_semantic(node):
    """
    Transforms an AST statement node into its canonical semantic form.
    Applies identity elimination, commutative sorting, constant folding, and variable canonicalization.
    """
    normalizer = SemanticNormalizer()
    transformed = normalizer.visit(node)
    ast.fix_missing_locations(transformed)

    renamer = CanonicalIdentifierRenamer()
    canonicalized = renamer.visit(transformed)
    ast.fix_missing_locations(canonicalized)

    return ast.dump(canonicalized)

def extract_semantic_candidates(source_code):
    """
    Parses Python source code and extracts statements with line numbers and semantic fingerprints.
    """
    candidates = []
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        return candidates

    lines = source_code.splitlines()

    for node in ast.walk(tree):
        if isinstance(node, (ast.Assign, ast.AugAssign, ast.Expr, ast.Return, ast.If, ast.For, ast.While)):
            if not hasattr(node, "lineno"):
                continue

            # Ignore trivial imports or docstrings
            if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                continue

            start_line = node.lineno
            end_line = getattr(node, "end_lineno", start_line)

            snippet = "\n".join(lines[start_line - 1:end_line]).strip() if start_line <= len(lines) else ""
            if not snippet:
                continue

            try:
                # Node copy for independent normalization
                node_copy = ast.parse(ast.unparse(node)).body[0]
                fingerprint = normalize_semantic(node_copy)
                candidates.append({
                    "start_line": start_line,
                    "end_line": end_line,
                    "code": snippet,
                    "kind": type(node).__name__,
                    "semantic_fingerprint": fingerprint
                })
            except Exception:
                continue

    return candidates
