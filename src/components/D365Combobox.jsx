import { useState, useEffect, useRef } from 'react';
import { searchContacts, searchAccounts, resolveContact, resolveAccount } from '../api/d365';
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
 * Combobox con búsqueda en tiempo real contra Dataverse.
 * entityType: 'contact' | 'account'
 * value: GUID seleccionado (string) | ''
 * onChange: (guid: string) => void
 */
const D365Combobox = ({ entityType, value, onChange, disabled }) => {
  const [open, setOpen]               = useState(false);
  const [query, setQuery]             = useState('');
  const [options, setOptions]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const debounceRef = useRef(null);

  const isContact = entityType === 'contact';

  // Resolver nombre del GUID inicial (para modo edición)
  useEffect(() => {
    if (!value) { setSelectedLabel(''); return; }
    const resolve = isContact ? resolveContact : resolveAccount;
    resolve(value)
      .then((r) => setSelectedLabel(r.name || value))
      .catch(() => setSelectedLabel(value.slice(0, 8) + '…'));
  }, []); // solo al montar

  // Búsqueda con debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setOptions([]); setLoading(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const search = isContact ? searchContacts : searchAccounts;
        setOptions(await search(query));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [query, entityType]);

  const handleSelect = (opt) => {
    onChange(opt.id);
    setSelectedLabel(opt.name);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSelectedLabel('');
    setOptions([]);
    setQuery('');
  };

  const displayText = selectedLabel || (value ? value.slice(0, 8) + '…' : '');
  const placeholder = isContact ? 'Buscar contacto…' : 'Buscar empresa…';

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
            {value && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-40" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-80" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {/* Cargando */}
            {loading && (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando…
              </div>
            )}

            {/* Instrucción inicial */}
            {!loading && query.length < 2 && (
              <CommandEmpty>Escribe al menos 2 caracteres para buscar</CommandEmpty>
            )}

            {/* Sin resultados */}
            {!loading && query.length >= 2 && options.length === 0 && (
              <CommandEmpty>Sin resultados para "{query}"</CommandEmpty>
            )}

            {/* Resultados */}
            {!loading && options.length > 0 && (
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.id}
                    onSelect={() => handleSelect(opt)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === opt.id ? 'opacity-100 text-primary' : 'opacity-0'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{opt.name}</p>
                      {opt.email && (
                        <p className="text-xs text-muted-foreground truncate">{opt.email}</p>
                      )}
                      {opt.phone && !opt.email && (
                        <p className="text-xs text-muted-foreground">{opt.phone}</p>
                      )}
                    </div>
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

export default D365Combobox;
