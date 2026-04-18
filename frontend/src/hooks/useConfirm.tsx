import { useCallback, useRef, useState } from 'react';
import ConfirmModal from '../components/common/ConfirmModal';

type Tone = 'default' | 'danger';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

// Hook-style API so call sites stay flat:
//   const { confirm, confirmNode } = useConfirm();
//   if (await confirm({ title, message, tone: 'danger' })) { ...mutate }
//   // render {confirmNode} once somewhere in the component.
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { isOpen: boolean; loading: boolean }) | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...opts, isOpen: true, loading: false });
    });
  }, []);

  const close = (ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setState(null);
  };

  const confirmNode = state ? (
    <ConfirmModal
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      tone={state.tone}
      loading={state.loading}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return { confirm, confirmNode };
}
