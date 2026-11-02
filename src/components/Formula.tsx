import katex from 'katex';
import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { mathPartToLatex, splitMathText } from '../math-format';

export function Formula({ children, block = true, label }: { children: string; block?: boolean; label?: string }) {
  return <span role="math" aria-label={label ?? children} className={block ? 'formula block' : 'formula'} dangerouslySetInnerHTML={{__html:katex.renderToString(children,{throwOnError:false,displayMode:block,output:'htmlAndMathml'})}} />;
}

export function MathText({ children }: { children: string }) {
  return <>{splitMathText(children).map((part, index) => part.type === 'math'
    ? <Formula block={false} label={part.value} key={index}>{mathPartToLatex(part)}</Formula>
    : part.value)}</>;
}

const plainTextContainers = new Set(['code', 'pre', 'script', 'style', 'svg', 'select', 'textarea']);

function mathChildren(children: ReactNode): ReactNode {
  return Children.map(children, child => {
    if (typeof child === 'string') return <MathText>{child}</MathText>;
    if (!isValidElement(child) || child.type === Formula || child.type === MathText) return child;
    if (typeof child.type === 'string' && plainTextContainers.has(child.type)) return child;
    const props = child.props as { children?: ReactNode; dangerouslySetInnerHTML?: unknown };
    if (props.dangerouslySetInnerHTML || props.children === undefined || typeof props.children === 'function') return child;
    return cloneElement(child, {}, mathChildren(props.children));
  });
}

export function MathContent({ children }: { children: ReactNode }) {
  return <>{mathChildren(children)}</>;
}
