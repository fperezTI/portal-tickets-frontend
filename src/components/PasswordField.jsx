import { forwardRef, useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Campo de contraseña con candado y botón mostrar/ocultar, mismo estilo que el
// login. Para las pantallas de contraseña (2026-11-23). Se usa con
// react-hook-form: <PasswordField label=… error=… {...register('x')} />.
const PasswordField = forwardRef(({ id, label, error, showLabel, hideLabel, autoComplete = 'new-password', ...props }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input id={id} ref={ref} type={show ? 'text' : 'password'} autoComplete={autoComplete} className="h-11 pl-10 pr-10" {...props} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? hideLabel : showLabel}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
});
PasswordField.displayName = 'PasswordField';

export default PasswordField;
