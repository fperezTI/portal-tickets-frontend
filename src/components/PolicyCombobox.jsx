import { useState, useEffect, useRef } from 'react';
import { searchPolicies } from '../api/policies';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Combobox de búsqueda de pólizas (cre2f_policy) por nombre/número.
 * value: GUID seleccionado (string) | ''
 * label: nombre de la póliza ya seleccionada (evita tener que resolverlo por id)
 * onChange: (policyId: string, policyName: string) => void — se llama con ('', '') al limpiar
 */
const PolicyCombobox = ({ value, label, onChange, disabled, placeholder = 'Buscar póliza…' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) { setOptions([]); setLoading(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setOptions(await searchPolicies(query));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (opt) => {
    onChange(opt.id, opt.name);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', '');
    setOptions([]);
    setQuery('');
  };

  const displayText = label || (value ? value.slice(0, 8) + '…' : '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          <span className={cn('truncate text-sm', !displayText && 'text-muted-foreground')}>
            {displayText || placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0 ml-2">
            {value && !disabled && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-40" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-72" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
              </div>
            )}
            {!loading && !query && (
              <CommandEmpty>Escribe para buscar una póliza</CommandEmpty>
            )}
            {!loading && query && options.length === 0 && (
              <CommandEmpty>Sin resultados para "{query}"</CommandEmpty>
            )}
            {!loading && options.length > 0 && (
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem key={opt.id} value={opt.id} onSelect={() => handleSelect(opt)} className="cursor-pointer">
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt.id ? 'opacity-100 text-primary' : 'opacity-0')} />
                    <span className="truncate text-sm">{opt.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default PolicyCombobox;
