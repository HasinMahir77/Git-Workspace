import { useEffect, useRef } from "react";
import type { InputHTMLAttributes } from "react";

export function IndeterminateCheckbox({ isIndeterminate, ...props }: { isIndeterminate: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current) input.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);
  return <input ref={input} type="checkbox" {...props} />;
}
