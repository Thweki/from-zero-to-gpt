import katex from 'katex';
export function Formula({ children, block = true }: { children: string; block?: boolean }) {
  return <span className={block ? 'formula block' : 'formula'} dangerouslySetInnerHTML={{__html:katex.renderToString(children,{throwOnError:false,displayMode:block,output:'htmlAndMathml'})}} />;
}
