/** Restricted parser for the migration CHECKs and pg_get_expr deparses.
 * Unknown syntax fails closed. Parentheses/boolean precedence are never discarded.
 */
export function canonicalCheck(expression: string | null): string | null {
  if (expression === null) return null;
  const tokens = expression.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|::|>=|<=|[=><()\-]|\d+|[A-Za-z_][A-Za-z_0-9]*|\s+|./g)!
    .filter(token => !/^\s+$/.test(token));
  let index = 0;
  const peek = () => tokens[index];
  const take = (token: string) => {
    if (peek() !== token) throw new Error('Unsupported CHECK');
    index++;
  };
  type Node = string | { op: string; args: Node[] };
  const node = (op: string, ...args: Node[]): Node => ({ op, args });
  const boolean = (op: string, left: Node, right: Node): Node => ({
    op, args: [left, right].flatMap(value => typeof value !== 'string' && value.op === op ? value.args : [value]),
  });
  function atom(): Node {
    let value: Node;
    const token = tokens[index++];
    if (token === '(') { value = or(); take(')'); }
    else if (token && /^(?:'(?:''|[^'])*'|"(?:""|[^"])*"|\d+|[A-Za-z_][A-Za-z_0-9]*)$/.test(token))
      value = token.startsWith('"') ? token.slice(1, -1) : token;
    else throw new Error('Unsupported CHECK atom');
    while (peek() === '::') {
      index++;
      const type = tokens[index++];
      // Only lossless deparser casts for the migration's columns/constants.
      if (type === 'text') {
        if (typeof value !== 'string' || (value !== 'efecto' && !value.startsWith("'"))) throw new Error('Unsafe cast');
      } else if (type === 'numeric' || type === 'integer') {
        if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Unsafe cast');
      } else throw new Error('Unsupported cast');
    }
    return value;
  }
  function subtraction(): Node {
    let value = atom();
    while (peek() === '-') { index++; value = node('-', value, atom()); }
    return value;
  }
  function comparison(): Node {
    const left = subtraction();
    const op = peek();
    if (op === 'IS') {
      index++;
      const not = peek() === 'NOT';
      if (not) index++;
      take('NULL');
      return node(not ? 'notnull' : 'null', left);
    }
    if (op === 'BETWEEN') {
      index++;
      const lower = subtraction(); take('AND'); const upper = subtraction();
      return boolean('AND', node('>=', left, lower), node('<=', left, upper));
    }
    if (op && ['=', '>', '<', '>=', '<='].includes(op)) {
      index++;
      return node(op, left, subtraction());
    }
    return left;
  }
  function and(): Node {
    let value = comparison();
    while (peek() === 'AND') { index++; value = boolean('AND', value, comparison()); }
    return value;
  }
  function or(): Node {
    let value = and();
    while (peek() === 'OR') { index++; value = boolean('OR', value, and()); }
    return value;
  }
  try {
    const value = or();
    if (index !== tokens.length) return null;
    return JSON.stringify(value);
  } catch { return null; }
}
