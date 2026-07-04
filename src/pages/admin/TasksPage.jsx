import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTasks, updateTask } from '../../api/tasks';
import { searchSystemUsers } from '../../api/d365';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Filtro multi-selección de usuarios ───────────────────────────────────────
const UserMultiSelect = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) { setOptions([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setOptions(await searchSystemUsers(query));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const toggle = (user) => {
    const exists = selected.some((u) => u.id === user.id);
    onChange(exists ? selected.filter((u) => u.id !== user.id) : [...selected, user]);
  };

  const remove = (id) => onChange(selected.filter((u) => u.id !== id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" size="sm" className="h-8 text-sm justify-between w-56">
            <span className="text-muted-foreground truncate">
              {selected.length ? `${selected.length} usuario${selected.length > 1 ? 's' : ''} seleccionado${selected.length > 1 ? 's' : ''}` : 'Usuario que creó…'}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-80" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar usuario…" value={query} onValueChange={setQuery} />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                </div>
              )}
              {!loading && query.length < 2 && (
                <CommandEmpty>Escribe al menos 2 caracteres para buscar</CommandEmpty>
              )}
              {!loading && query.length >= 2 && options.length === 0 && (
                <CommandEmpty>Sin resultados para "{query}"</CommandEmpty>
              )}
              {!loading && options.length > 0 && (
                <CommandGroup>
                  {options.map((opt) => {
                    const isSelected = selected.some((u) => u.id === opt.id);
                    return (
                      <CommandItem key={opt.id} value={opt.id} onSelect={() => toggle(opt)} className="cursor-pointer">
                        <Check className={cn('mr-2 h-4 w-4 shrink-0', isSelected ? 'opacity-100 text-primary' : 'opacity-0')} />
                        <span className="truncate text-sm">{opt.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.map((u) => (
        <span key={u.id} className="inline-flex items-center gap-1 text-xs font-medium bg-muted rounded-full pl-2.5 pr-1 py-1">
          {u.name}
          <button type="button" onClick={() => remove(u.id)} className="rounded-full hover:bg-background/60 p-0.5">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
};

// ─── Utilidades de fecha ───────────────────────────────────────────────────────
const toDatetimeLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromDatetimeLocal = (local) => (local ? new Date(local).toISOString() : null);

// ─── Fila editable ─────────────────────────────────────────────────────────────
const TaskRow = ({ task, onSaved, onNavigate }) => {
  const [dueDateLocal, setDueDateLocal] = useState(toDatetimeLocal(task.dueDate));
  const [billableHours, setBillableHours] = useState(task.billableHours ?? '');
  const [reworkingHours, setReworkingHours] = useState(task.reworkingHours ?? '');
  const [isAudit, setIsAudit] = useState(!!task.isAudit);
  const [savingField, setSavingField] = useState(null);

  const save = async (patch, revert) => {
    setSavingField(Object.keys(patch)[0]);
    try {
      const updated = await updateTask(task.id, patch);
      onSaved(task.id, updated);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar el cambio');
      revert();
    } finally {
      setSavingField(null);
    }
  };

  const handleDueDateBlur = () => {
    const nextIso = fromDatetimeLocal(dueDateLocal);
    if (nextIso === (task.dueDate || null)) return;
    save({ dueDate: nextIso }, () => setDueDateLocal(toDatetimeLocal(task.dueDate)));
  };

  const handleHoursBlur = () => {
    const num = billableHours === '' ? null : parseFloat(billableHours);
    if (num === (task.billableHours ?? null)) return;
    save({ billableHours: num }, () => setBillableHours(task.billableHours ?? ''));
  };

  const handleReworkingBlur = () => {
    const num = reworkingHours === '' ? null : parseFloat(reworkingHours);
    if (num === (task.reworkingHours ?? null)) return;
    save({ reworkingHours: num }, () => setReworkingHours(task.reworkingHours ?? ''));
  };

  const handleAuditChange = (checked) => {
    setIsAudit(checked);
    save({ isAudit: checked }, () => setIsAudit(task.isAudit));
  };

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="pl-6 pr-4 py-2.5 max-w-[220px]">
        <button
          onClick={() => onNavigate(task.regardingId)}
          className="text-sm font-medium text-primary hover:underline text-left line-clamp-2"
          title={task.regardingName}
        >
          {task.regardingName || '—'}
        </button>
      </td>
      <td className="px-4 py-2.5 max-w-[240px]">
        <span className="text-sm line-clamp-2">{task.subject || '—'}</span>
      </td>
      <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap max-w-[160px] truncate">
        {task.createdByName || '—'}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Input
            type="datetime-local"
            value={dueDateLocal}
            onChange={(e) => setDueDateLocal(e.target.value)}
            onBlur={handleDueDateBlur}
            className="h-8 text-xs w-[170px]"
          />
          {savingField === 'dueDate' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        </div>
      </td>
      <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
        {task.durationHours != null ? `${task.durationHours} h` : '—'}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step="0.25"
            min="0"
            value={billableHours}
            onChange={(e) => setBillableHours(e.target.value)}
            onBlur={handleHoursBlur}
            className="h-8 text-xs w-20"
          />
          {savingField === 'billableHours' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step="0.25"
            min="0"
            value={reworkingHours}
            onChange={(e) => setReworkingHours(e.target.value)}
            onBlur={handleReworkingBlur}
            className="h-8 text-xs w-20"
          />
          {savingField === 'reworkingHours' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Switch checked={isAudit} onCheckedChange={handleAuditChange} />
          {savingField === 'isAudit' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
        </div>
      </td>
    </tr>
  );
};

// ─── Página ────────────────────────────────────────────────────────────────────
const COLS = ['Ticket', 'Asunto', 'Creado por', 'Fecha límite', 'Duración', 'Horas facturables', 'Reworking', 'Es auditoría'];

const TasksPage = () => {
  const navigate = useNavigate();
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [tasks, setTasks] = useState([]);
  const [nextLink, setNextLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTasks = useCallback(async (link = null) => {
    try {
      setLoading(true);
      setError('');
      const params = link
        ? { nextLink: link }
        : {
            ...(selectedUsers.length ? { createdBy: selectedUsers.map((u) => u.id).join(',') } : {}),
            ...(dueDateFrom ? { dueDateFrom: new Date(dueDateFrom).toISOString() } : {}),
            ...(dueDateTo   ? { dueDateTo:   new Date(dueDateTo + 'T23:59:59').toISOString() } : {}),
            ...(subject     ? { subject } : {}),
          };
      const result = await listTasks(params);
      setTasks((prev) => (link ? [...prev, ...result.data] : result.data));
      setNextLink(result.nextLink);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar las tareas');
    } finally {
      setLoading(false);
    }
  }, [selectedUsers, dueDateFrom, dueDateTo, subject]);

  useEffect(() => {
    setTasks([]);
    setNextLink(null);
    fetchTasks();
  }, [selectedUsers, dueDateFrom, dueDateTo, subject]);

  const handleSaved = (id, updated) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
  };

  const hasActiveFilters = selectedUsers.length > 0 || dueDateFrom || dueDateTo || subject;
  const clearFilters = () => {
    setSelectedUsers([]);
    setDueDateFrom('');
    setDueDateTo('');
    setSubject('');
    setSubjectInput('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tareas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Actividades tipo tarea asociadas a tickets</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <form
          onSubmit={(e) => { e.preventDefault(); setSubject(subjectInput.trim()); }}
          className="flex gap-1.5"
        >
          <Input
            placeholder="Buscar por asunto…"
            value={subjectInput}
            onChange={(e) => setSubjectInput(e.target.value)}
            className="w-56 h-8 text-sm"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-8 px-3">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </form>

        <UserMultiSelect selected={selectedUsers} onChange={setSelectedUsers} />

        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">Desde</Label>
          <Input type="date" value={dueDateFrom} onChange={(e) => setDueDateFrom(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">Hasta</Label>
          <Input type="date" value={dueDateTo} onChange={(e) => setDueDateTo(e.target.value)} className="h-8 text-sm w-36" />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" /> Limpiar
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={() => fetchTasks()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-muted-foreground">
            {loading && tasks.length === 0 ? 'Cargando…' : `${tasks.length}${nextLink ? '+' : ''} tarea${tasks.length !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && tasks.length === 0 ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              No hay tareas con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur border-b">
                  <tr>
                    {COLS.map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap first:pl-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tasks.map((t) => (
                    <TaskRow key={t.id} task={t} onSaved={handleSaved} onNavigate={(id) => navigate(`/cases/${id}`)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nextLink && !loading && (
            <div className="py-1 px-4 text-center border-t">
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => fetchTasks(nextLink)}>
                Cargar más tareas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TasksPage;
