import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {LoaderCircle, Sparkles, X} from 'lucide-react';
import type {Lesson} from '../types';
import {selectionImageLimit, type TutorSelection} from '../tutor-selection';
import './SelectionTutor.css';

type Graphic = HTMLImageElement | SVGSVGElement | HTMLCanvasElement;
type Pick = {selection?: TutorSelection; graphic?: Graphic; x:number; y:number};
const excluded = 'input,textarea,select,button,a,[contenteditable="true"],.tutor-panel,.tutor-selection-popup,.katex-mathml';
const graphicSelector = 'img,svg[role="img"],canvas';
const compact = (text:string) => text.replace(/\s+/g, ' ').trim();

function selectedText(range:Range) {
  // KaTeX has both visual and accessible representations; send its source once.
  const fragment = range.cloneContents();
  fragment.querySelectorAll('.katex').forEach(math => {
    const tex = math.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (tex) math.replaceWith(document.createTextNode(` $${tex}$ `));
  });
  fragment.querySelectorAll('.katex-mathml,script,style').forEach(node => node.remove());
  return compact(fragment.textContent || '');
}

async function rasterPreview(graphic:Graphic):Promise<string|undefined> {
  const bounds = graphic.getBoundingClientRect();
  const scale = Math.min(1, 900 / Math.max(bounds.width, bounds.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let drawable:CanvasImageSource = graphic as HTMLImageElement | HTMLCanvasElement;
  let objectURL = '';
  try {
    if (graphic instanceof SVGSVGElement) {
      // Freeze the rendered experiment, including theme colors. Strip active content
      // and external references before rendering the SVG locally into a raster.
      const clone = graphic.cloneNode(true) as SVGSVGElement;
      const sources = [graphic, ...graphic.querySelectorAll('*')];
      const targets = [clone, ...clone.querySelectorAll('*')];
      const properties = ['fill','stroke','stroke-width','stroke-dasharray','opacity','fill-opacity','stroke-opacity','font-size','font-family','font-weight','text-anchor','color'];
      sources.forEach((source, i) => {
        const computed = getComputedStyle(source);
        const target = targets[i] as SVGElement;
        target.removeAttribute('class');target.removeAttribute('style');
        properties.forEach(key => target.style.setProperty(key, computed.getPropertyValue(key)));
        for (const attribute of [...target.attributes]) {
          if (/^on/i.test(attribute.name) || /href$/i.test(attribute.name) || (attribute.value.includes('url(') && !/^url\(["']?#/.test(attribute.value))) target.removeAttribute(attribute.name);
        }
      });
      clone.querySelectorAll('script,foreignObject,image,use,style,animate,animateTransform,set').forEach(node => node.remove());
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(canvas.width));clone.setAttribute('height', String(canvas.height));
      objectURL = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], {type:'image/svg+xml'}));
      const image = new Image();image.src = objectURL;await image.decode();drawable = image;
    }
    ctx.drawImage(drawable, 0, 0, canvas.width, canvas.height);
    // No network fetch: cross-origin images without CORS fall back to their caption.
    for (const quality of [0.86, 0.65, 0.4]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= selectionImageLimit) return data;
    }
  } catch { /* The caption remains usable if the browser cannot copy pixels. */ }
  finally {if (objectURL) URL.revokeObjectURL(objectURL);}
}

export function SelectionTutor({lesson, resetKey, values, onPick}:{lesson:Lesson;resetKey:string;values:Record<string,number>;onPick:(selection:TutorSelection)=>void}) {
  const [pick,setPick] = useState<Pick|null>(null), [busy,setBusy] = useState(false);
  const popup = useRef<HTMLDivElement>(null), generation = useRef(0), transferring=useRef(false);
  useEffect(() => {
    generation.current++;transferring.current=false;setPick(null);setBusy(false);
    const root = document.getElementById('main-content');
    if (!root) return;
    let timer:ReturnType<typeof setTimeout>;
    let scrollX=window.scrollX,scrollY=window.scrollY;
    const rememberScroll=()=>{scrollX=window.scrollX;scrollY=window.scrollY;};
    const eligible = (node:Node|null) => {
      const element = node instanceof Element ? node : node?.parentElement;
      return Boolean(element && root.contains(element) && !element.closest(excluded));
    };
    const read = (point?:{x:number;y:number}) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount || !eligible(selection.anchorNode) || !eligible(selection.focusNode)) {setPick(null);return false;}
      const range = selection.getRangeAt(0);
      if (range.cloneContents().querySelector('input,textarea,[contenteditable="true"],.tutor-panel')) {setPick(null);return false;}
      const text = selectedText(range);
      if (!text) {setPick(null);return false;}
      const rect = range.getBoundingClientRect();
      rememberScroll();
      setPick({selection:{kind:'text',title:lesson.title,text:text.length>3000?`${text.slice(0,2960)}\n（选区较长，以上为前 2960 字。）`:text},x:point?.x??rect.right,y:point?.y??rect.bottom});
      return true;
    };
    const pointerUp = (event:PointerEvent) => {
      if (popup.current?.contains(event.target as Node)) return;
      clearTimeout(timer);
      if (read({x:event.clientX,y:event.clientY})) return;
      const target = event.target instanceof Element ? event.target.closest(graphicSelector) : null;
      if (target && eligible(target) && !target.closest('button,a,[role="button"]')) {rememberScroll();setPick({graphic:target as Graphic,x:event.clientX,y:event.clientY});}
    };
    const selectionChange = () => {
      clearTimeout(timer);
      if (document.activeElement?.closest('.tutor-selection-popup')) return;
      timer = setTimeout(() => {if (!window.getSelection()?.isCollapsed) read();else setPick(current=>current?.graphic?current:null);},180);
    };
    const keyDown = (event:KeyboardEvent) => {
      if (event.key === 'Escape') {generation.current++;transferring.current=false;setPick(null);setBusy(false);return;}
      if (event.key === 'Enter' && event.altKey && read()) {
        event.preventDefault();requestAnimationFrame(()=>popup.current?.querySelector('button')?.focus());return;
      }
      if (event.key === 'Enter' && event.target instanceof Element && event.target.matches(graphicSelector)) {
        event.preventDefault();const rect=event.target.getBoundingClientRect();
        rememberScroll();
        setPick({graphic:event.target as Graphic,x:rect.right,y:rect.bottom});
        requestAnimationFrame(()=>popup.current?.querySelector('button')?.focus());
      }
    };
    const dismiss = (event:Event) => {
      if (transferring.current || popup.current?.contains(event.target as Node)) return;
      // Focusing a graph can queue a scroll event after pointerup even though
      // the viewport already moved before the popup was positioned.
      if(event.type==='scroll'&&event.target===document&&window.scrollX===scrollX&&window.scrollY===scrollY)return;
      generation.current++;setPick(null);setBusy(false);
    };
    const makeFocusable = () => root.querySelectorAll(graphicSelector).forEach(image => {if (!image.closest(excluded) && !image.hasAttribute('tabindex')) {image.setAttribute('tabindex','0');image.setAttribute('aria-description','点击或按 Enter，选择图片后向 AI 导师提问');}});
    makeFocusable();const observer=new MutationObserver(makeFocusable);observer.observe(root,{childList:true,subtree:true});
    document.addEventListener('pointerup',pointerUp);document.addEventListener('selectionchange',selectionChange);document.addEventListener('keydown',keyDown);
    document.addEventListener('scroll',dismiss,true);window.addEventListener('resize',dismiss);
    return () => {generation.current++;clearTimeout(timer);observer.disconnect();document.removeEventListener('pointerup',pointerUp);document.removeEventListener('selectionchange',selectionChange);document.removeEventListener('keydown',keyDown);document.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);};
  },[lesson.id,lesson.title,resetKey]);

  if (!pick) return null;
  const width=190,height=46;
  const left=Math.max(8,Math.min(pick.x+10,window.innerWidth-width-8));
  const top=Math.max(8,Math.min(pick.y+12,window.innerHeight-height-8));
  const transfer = async () => {
    if (busy) return;
    const token=++generation.current;
    transferring.current=true;setBusy(true);
    let selection=pick.selection;
    if (pick.graphic) {
      const graphic=pick.graphic;
      const title=compact(graphic.getAttribute('aria-label') || (graphic instanceof HTMLImageElement?graphic.alt:'') || graphic.querySelector('title')?.textContent || '教材图片').slice(0,160);
      const plot=graphic.closest('section');
      const equation=plot?.querySelector('.plot-equation')?.textContent;
      const result=plot?.querySelector('.live-result')?.textContent;
      const labels=compact([...graphic.querySelectorAll('text')].map(node=>node.textContent).join(' '));
      const text=[`章节：${lesson.title}`,`图表：${title}`,equation&&`公式：${compact(equation)}`,result&&`当前结果：${compact(result)}`,labels&&`图内标注：${labels}`,Object.keys(values).length&&`选择时的实验参数：${JSON.stringify(values)}`].filter(Boolean).join('\n').slice(0,3000);
      // Snapshot pixels synchronously before yielding, so moving a slider later
      // cannot change the selected experiment's meaning.
      const preview=rasterPreview(graphic);
      selection={kind:'image',title,text,image:await preview};
    }
    if (token!==generation.current || !selection) return;
    if (document.fullscreenElement) {try {await document.exitFullscreen();} catch {transferring.current=false;setBusy(false);return;}}
    if (token!==generation.current) return;
    onPick(selection);window.getSelection()?.removeAllRanges();transferring.current=false;setPick(null);setBusy(false);
  };
  return createPortal(<div ref={popup} className="tutor-selection-popup" role="toolbar" aria-label="选中内容操作" aria-keyshortcuts="Alt+Enter" style={{left,top}} onPointerDown={event=>event.preventDefault()}>
    <button type="button" disabled={busy} aria-label="将选中内容带到 AI 导师" onClick={()=>void transfer()}>{busy?<LoaderCircle size={15}/>:<Sparkles size={15}/>}<span>{busy?'正在带入…':'问导师'}</span></button>
    <button type="button" className="selection-dismiss" aria-label="取消选中内容操作" onClick={()=>{generation.current++;transferring.current=false;setPick(null);setBusy(false);}}><X size={15}/></button>
  </div>,document.fullscreenElement || document.body);
}
