export type MathTextPart = { type: 'text' | 'math'; value: string };

const superscripts: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ᵀ': 'T', 'ᴴ': 'H', 'ᵐ': 'm', 'ˣ': 'x',
};
const subscripts: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')', 'ₐ': 'a', 'ₑ': 'e', ₒ: 'o', ₓ: 'x', ₕ: 'h', ₖ: 'k', ₗ: 'l', ₘ: 'm', ₙ: 'n', ₚ: 'p', ₛ: 's', ₜ: 't', 'ᵢ': 'i', 'ⱼ': 'j',
};
const symbols: Record<string, string> = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\varepsilon', ϵ: '\\epsilon', ζ: '\\zeta', η: '\\eta',
  θ: '\\theta', λ: '\\lambda', μ: '\\mu', ν: '\\nu', ξ: '\\xi', π: '\\pi', ρ: '\\rho', σ: '\\sigma', τ: '\\tau',
  φ: '\\varphi', χ: '\\chi', ψ: '\\psi', ω: '\\omega', Γ: '\\Gamma', Δ: '\\Delta', Θ: '\\Theta', Λ: '\\Lambda',
  Π: '\\Pi', Σ: '\\sum ', Φ: '\\Phi', Ψ: '\\Psi', Ω: '\\Omega', ℝ: '\\mathbb{R}',
  '−': '-', '×': '\\times', '·': '\\cdot', '⋅': '\\cdot', '÷': '\\div', '±': '\\pm', '≤': '\\le', '≥': '\\ge',
  '≠': '\\ne', '≈': '\\approx', '∼': '\\sim', '→': '\\to', '↦': '\\mapsto', '←': '\\leftarrow', '↔': '\\leftrightarrow',
  '∞': '\\infty', '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∂': '\\partial', '∇': '\\nabla', '∈': '\\in',
  '∉': '\\notin', '⊂': '\\subset', '⊆': '\\subseteq', '∪': '\\cup', '∩': '\\cap', '∀': '\\forall', '∃': '\\exists',
  '¬': '\\neg', '∅': '\\varnothing', '‖': '\\|', '…': '\\ldots', '°': '^{\\circ}', '′': "'", '″': "''",
};
const functions = ['sigmoid', 'softmax', 'Bernoulli', 'ReLU', 'tanh', 'sin', 'cos', 'log', 'ln', 'exp', 'det', 'square', 'dot', 'norm', 'MHA', 'LN'];
const mathWords = ['logits', 'mask', 'margin'];
const symbolCommands = [...new Set(Object.values(symbols))]
  .filter(command => /^\\[A-Za-z]+$/.test(command))
  .sort((a, b) => b.length - a.length)
  .map(command => command.replace(/\\/g, '\\\\'))
  .join('|');

function convertScripts(input: string, table: Record<string, string>, marker: '_' | '^') {
  const chars = Object.keys(table).join('');
  return input.replace(new RegExp(`[${chars}]+`, 'gu'), run => `${marker}{${Array.from(run, char => table[char]).join('')}}`);
}

function replaceSquareRoots(input: string) {
  let output = '', cursor = 0;
  while (cursor < input.length) {
    const root = input.indexOf('√', cursor);
    if (root < 0) return output + input.slice(cursor);
    output += input.slice(cursor, root);
    if (input[root + 1] === '(') {
      let depth = 1, end = root + 2;
      while (end < input.length && depth) {
        if (input[end] === '(') depth++;
        else if (input[end] === ')') depth--;
        end++;
      }
      if (!depth) {
        output += `\\sqrt{${input.slice(root + 2, end - 1)}}`;
        cursor = end;
        continue;
      }
    }
    const argument = input.slice(root + 1).match(/^[A-Za-z0-9]+(?:_\{[^}]+\})?/);
    if (argument) {
      output += `\\sqrt{${argument[0]}}`;
      cursor = root + 1 + argument[0].length;
    } else {
      output += '\\sqrt';
      cursor = root + 1;
    }
  }
  return output;
}

export function plainMathToLatex(input: string): string {
  let output = input;
  output = output.replace(/([A-Za-z])(?:\*\*|\^)([A-Za-z0-9.]+)/g, '$1^{$2}');
  output = output.replace(/_([A-Za-z0-9]+)/g, '_{$1}');
  output = convertScripts(output, superscripts, '^');
  output = convertScripts(output, subscripts, '_');
  output = output.replace(/([A-Za-z])̂/g, '\\hat{$1}').replace(/([A-Za-z])̄/g, '\\bar{$1}');
  output = output.replace(/ŷ/g, '\\hat{y}').replace(/x̂/g, '\\hat{x}');
  output = replaceSquareRoots(output);
  output = Array.from(output, char => symbols[char] ?? char).join('');
  output = output.replace(new RegExp(`(${symbolCommands})(?=[A-Za-z])`, 'g'), '$1 ');
  output = output.replace(/(?<!\d)\b(\d+(?:\.\d+)?)e([+-]?\d+)\b/gi, '$1\\times10^{$2}');
  for (const name of functions) output = output.replace(new RegExp(`(?<![\\\\A-Za-z])${name}((?:_\\{[^}]+\\}|_[A-Za-z0-9]+)?)\\s*\\(`, 'g'), `\\operatorname{${name}}$1(`);
  for (const name of mathWords) output = output.replace(new RegExp(`(?<![\\\\A-Za-z])${name}\\b`, 'g'), `\\mathrm{${name}}`);
  output = output.replace(/[\p{Script=Han}]+\s*/gu, text => `\\text{${text}}`);
  output = output.replace(/(?<!\\)%/g, '\\%').replace(/(?<!\\)&/g, '\\&');
  return output;
}

const atom = String.raw`(?:[A-Za-z\u0370-\u03ff0-9ŷx̂₀-₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼ¹²³⁰-⁹⁺⁻⁽⁾ⁿᵀᴴᵐˣ]+|[()[\]{}|]|[-+−*/=<>≤≥≠≈∼~→↦←↔±×÷·⋅√∑∏∫∂∇∞∈∉⊂⊆∪∩¬∀∃%°′″‖…_.:^!])+`;
const localizedCall = String.raw`(?:[A-Za-z]|√)\([^()\n]{0,60}[\p{Script=Han}][^()\n]{0,60}\)`;
const localizedExpression = String.raw`[A-Za-z0-9]+\s*(?:−|\+|×|÷)\s*\p{Script=Han}[\p{Script=Han}A-Za-z0-9]*`;
const spacedOperator = String.raw`\s*(?:=|≤|≥|≠|≈|→|↦|\+|−|×|·|⋅|\/|,|\|)\s*`;
const candidate = new RegExp(`(?:${localizedCall}(?:\\s*=\\s*${localizedCall})?|${localizedExpression}|${atom}(?:${spacedOperator}${atom})*(?:${spacedOperator})?)`, 'gu');
const multiLetter = /[A-Za-z]{2,}/;
const mathFunction = /^(?:[A-Za-z]|sigmoid|softmax|Bernoulli|ReLU|tanh|sin|cos|log|ln|exp|det|square|dot|norm|MHA|LN)(?:_\{[^}]+\}|_[A-Za-z0-9]+)?\s*\(/;

function isMath(value: string, context: string) {
  const compact = value.replace(/\s/g, '');
  if (!compact || /^[\s\d.,%]+$/.test(value) && !/[,%]/.test(value)) return false;
  if (/^[A-Za-z\u0370-\u03ff]$/.test(compact)) return /\p{Script=Han}/u.test(context);
  if (/^[\s+\-−*/=<>≤≥≠≈∼~→↦←↔±×÷·⋅,|:]+$/.test(value)) return false;
  if (/^[/=<>≤≥≠≈→↦←↔±×÷·⋅]/.test(compact)) return false;
  if (multiLetter.test(compact) && /[·⋅×÷]/.test(compact) && !mathFunction.test(compact) && !/\d/.test(compact) && !/[=≠≤≥→↦√∑∏∫∂∇∞∈∉]/.test(compact)) return false;
  if (/[¹²³⁴⁵⁶⁷⁸⁹⁰ⁿᵀᴴᵐˣ₀-₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼ√∑∏∫∂∇∞∈∉≤≥≠≈→↦±×÷·⋅‖′″ŷ̂̄%]/.test(value)) return true;
  if (/^\(?[+-]?\d+(?:\.\d+)?\)?$/.test(compact)) return /[+-]/.test(compact);
  if (/^[[(][\d.,+\-−\s]+[\])]$/.test(compact) && /,/.test(compact)) return true;
  if (mathFunction.test(compact)) return true;
  if (/^[[(][A-Za-z0-9,+\-−\s]+[\])]$/.test(compact) && /,/.test(compact)) return true;
  if (/[=<>]/.test(compact) && !/^https?:/i.test(compact)) return true;
  if (/^[A-Za-z](?:[/][A-Za-z])+$/.test(compact)) return true;
  if (!multiLetter.test(compact) && /[+/]/.test(compact)) return true;
  if (/\d[A-Za-z]|[A-Za-z]\d/.test(compact) && /[+\-−*/^]/.test(compact)) return true;
  if (/\p{Script=Han}/u.test(compact) && /[+\-−×÷]/.test(compact)) return true;
  return false;
}

function autoParts(text: string): MathTextPart[] {
  const parts: MathTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(candidate)) {
    const value = match[0];
    if (!isMath(value, text)) continue;
    const index = match.index;
    if (index > last) parts.push({ type: 'text', value: text.slice(last, index) });
    parts.push({ type: 'math', value });
    last = index + value.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

export function splitMathText(text: string): MathTextPart[] {
  const parts: MathTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/\$([^$\n]+)\$/g)) {
    const index = match.index;
    if (index > last) parts.push(...autoParts(text.slice(last, index)));
    parts.push({ type: 'math', value: match[1] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(...autoParts(text.slice(last)));
  return parts.length ? parts : [{ type: 'text', value: text }];
}

export function mathPartToLatex(part: MathTextPart): string {
  return /\\[A-Za-z]+/.test(part.value) ? part.value : plainMathToLatex(part.value);
}
