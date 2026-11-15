import {forwardRef, useState, type ComponentPropsWithoutRef} from 'react';
import {learningLimits, textLimitMessage} from '../learning-limits';

type Props = Omit<ComponentPropsWithoutRef<'textarea'>, 'onChange' | 'value' | 'maxLength'> & {
  value: string;
  onValue: (value: string) => void;
  limit?: number;
};
// Reject the entire edit instead of letting native maxLength silently truncate a paste.
export const LimitedTextarea = forwardRef<HTMLTextAreaElement, Props>(function LimitedTextarea({value,onValue,limit=learningLimits.text,...props},ref){
  const [error,setError]=useState('');
  return <><textarea {...props} ref={ref} value={value} aria-invalid={error?true:undefined} onChange={event=>{
    const next=event.target.value;
    // Existing oversized content can be reduced during recovery without losing it on load.
    if(next.length>limit&&next.length>=value.length){setError(textLimitMessage(limit));return;}
    setError('');onValue(next);
  }}/>{error&&<p role="alert">{error}</p>}</>;
});
