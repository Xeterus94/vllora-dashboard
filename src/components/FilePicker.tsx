import { useRef } from 'react';
import { Paperclip } from 'lucide-react';

export function FilePicker({
  label,
  onFiles,
  accept,
  multiple,
  disabled,
  inputLabel,
}: {
  label: string;
  onFiles: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  inputLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="button secondary"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Paperclip size={17} aria-hidden="true" /> {label}
      </button>
      <input
        hidden
        ref={input}
        type="file"
        aria-label={inputLabel ?? label}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
